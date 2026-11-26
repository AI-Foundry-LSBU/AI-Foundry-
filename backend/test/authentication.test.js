import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { before, after, test } from 'node:test';
import pg from 'pg';
import { createApp } from '../src/app.js';
import { migrate, seed } from '../src/db/setup.js';
import { login, rawRequest, sessionSecret, testPasswords } from '../test-support/client.js';

const schema = `auth_test_${randomUUID().replaceAll('-', '')}`;
const credentials = ({ cookie, token }) => ({ cookie, token });
const oldStaffId = randomUUID();
const oldOpportunityId = randomUUID();
let admin;
let pool;
let createdSchema = false;

before(async () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  assert.ok(connectionString, 'Set TEST_DATABASE_URL before running the integration tests.');
  admin = new pg.Pool({ connectionString });
  await admin.query(`CREATE SCHEMA ${schema}`);
  createdSchema = true;
  pool = new pg.Pool({ connectionString, max: 1, onConnect: (client) => client.query(`SET search_path TO ${schema}`) });
  // Start from the pre-authentication schema and a saved request to exercise the upgrade.
  await pool.query('CREATE TABLE schema_migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP)');
  for (const file of ['001_initial.sql', '002_opportunity_assessments.sql', '003_opportunity_decisions.sql', '004_project_delivery.sql', '005_project_benefits.sql']) {
    await pool.query(await readFile(new URL(`../db/migrations/${file}`, import.meta.url), 'utf8'));
    await pool.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
  }
  await pool.query("INSERT INTO users (id, email, name, role) VALUES ($1, 'staff@example.com', 'Demo Staff', 'staff')", [oldStaffId]);
  await pool.query(`INSERT INTO opportunities (id, submitted_by, title, department, problem_description, proposed_improvement)
    VALUES ($1, $2, 'Keep this request', 'Estates', 'Existing problem', 'Existing solution')`, [oldOpportunityId, oldStaffId]);
  await migrate(pool);
  await seed(pool, testPasswords);
});

after(async () => {
  await pool?.end();
  if (createdSchema) await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin?.end();
});

async function start(t, options = {}) {
  const app = createApp(pool, { sessionSecret, sessionSchema: schema, pruneSessionInterval: false, ...options });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return server;
}

test('upgrade and repeat seeding preserve users, passwords and existing requests', async () => {
  const before = (await pool.query('SELECT id, email, password_hash, auth_version FROM users ORDER BY email')).rows;
  assert.equal(before.length, 4);
  assert.equal(before.find((user) => user.email === 'staff@lsbu.ac.uk').id, oldStaffId);
  assert.ok(before.every((user) => user.password_hash.startsWith('$argon2id$')));
  await migrate(pool);
  await seed(pool, testPasswords);
  assert.deepEqual((await pool.query('SELECT id, email, password_hash, auth_version FROM users ORDER BY email')).rows, before);
  assert.equal((await pool.query('SELECT submitted_by FROM opportunities WHERE id = $1', [oldOpportunityId])).rows[0].submitted_by, oldStaffId);
  await assert.rejects(seed(pool, {}), /DEMO_STAFF_PASSWORD/);
});

test('login checks passwords for all four accounts and returns only public account fields', async (t) => {
  const server = await start(t);
  for (const [email, role] of [['STAFF@LSBU.AC.UK', 'staff'], ['staff2@lsbu.ac.uk', 'staff'], ['manager@lsbu.ac.uk', 'manager'], ['engineer@lsbu.ac.uk', 'team']]) {
    const signedIn = await login(server, email);
    assert.equal(signedIn.status, 200);
    assert.equal(signedIn.body.user.role, role);
    assert.equal(signedIn.body.user.email, email.toLowerCase());
    assert.deepEqual(Object.keys(signedIn.body.user).sort(), ['email', 'id', 'name', 'role']);
    assert.notEqual(signedIn.cookie, signedIn.anonymousCookie);
    const header = signedIn.headers.get('set-cookie');
    assert.match(header, /HttpOnly/);
    assert.match(header, /SameSite=Lax/);
    assert.match(header, /Path=\/api\/v1/);
    assert.equal(signedIn.headers.get('cache-control'), 'no-store');
    const restored = await rawRequest(server, '/api/v1/auth/me', credentials(signedIn));
    assert.deepEqual(restored.body, signedIn.body);
  }
  const wrong = await login(server, 'staff@lsbu.ac.uk', 'Wrong password');
  const unknown = await login(server, 'unknown@lsbu.ac.uk', 'Wrong password');
  assert.equal(wrong.status, 401);
  assert.deepEqual(wrong.body, unknown.body);
});

test('forged demo headers, cookies and missing or incorrect CSRF tokens cannot authenticate or write', async (t) => {
  const server = await start(t);
  assert.equal((await rawRequest(server, '/api/v1/me/opportunities', { headers: { 'X-User-Email': 'manager@lsbu.ac.uk' } })).status, 401);
  assert.equal((await rawRequest(server, '/api/v1/auth/me', { cookie: 'foundry.sid=fake' })).status, 401);
  assert.equal((await rawRequest(server, '/api/v1/auth/login', { body: { email: 'staff@lsbu.ac.uk', password: testPasswords.DEMO_STAFF_PASSWORD } })).status, 403);
  const signedIn = await login(server, 'staff@lsbu.ac.uk');
  for (const token of [undefined, 'forged']) {
    assert.equal((await rawRequest(server, '/api/v1/auth/logout', { cookie: signedIn.cookie, token, method: 'POST' })).body.code, 'CSRF_INVALID');
    assert.equal((await rawRequest(server, '/api/v1/opportunities', { cookie: signedIn.cookie, token, body: {} })).body.code, 'CSRF_INVALID');
  }
  assert.equal((await rawRequest(server, '/api/v1/opportunities', { ...credentials(signedIn), headers: { 'X-User-Email': 'manager@lsbu.ac.uk' } })).status, 403);
  assert.equal((await rawRequest(server, '/api/v1/auth/me', credentials(signedIn))).body.user.role, 'staff');
});

test('login validates JSON and ignores a caller-supplied role', async (t) => {
  const server = await start(t);
  const anonymous = await rawRequest(server, '/api/v1/auth/csrf');
  const session = { cookie: anonymous.headers.getSetCookie()[0].split(';')[0], token: anonymous.body.csrfToken };
  for (const body of [null, [], {}, { email: 'staff@lsbu.ac.uk' }, { email: 'staff@lsbu.ac.uk', password: 'a'.repeat(129) }]) {
    assert.equal((await rawRequest(server, '/api/v1/auth/login', { ...session, body })).status, 400);
  }
  assert.equal((await rawRequest(server, '/api/v1/auth/login', { ...session, rawBody: '{' })).status, 400);
  assert.equal((await rawRequest(server, '/api/v1/auth/login', { ...session, rawBody: 'x'.repeat(10000) })).status, 413);
  const result = await rawRequest(server, '/api/v1/auth/login', {
    ...session, body: { email: ' staff@lsbu.ac.uk ', password: testPasswords.DEMO_STAFF_PASSWORD, role: 'manager' }
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.user.role, 'staff');
});

test('PostgreSQL sessions survive a server restart and logout invalidates the saved cookie', async (t) => {
  const first = await start(t);
  const signedIn = await login(first, 'staff@lsbu.ac.uk');
  await new Promise((resolve) => first.close(resolve));
  const second = await start(t);
  assert.equal((await rawRequest(second, '/api/v1/auth/me', credentials(signedIn))).status, 200);
  assert.equal((await rawRequest(second, '/api/v1/auth/logout', { ...credentials(signedIn), method: 'POST' })).status, 204);
  assert.equal((await rawRequest(second, '/api/v1/auth/me', credentials(signedIn))).status, 401);
});

test('inactive accounts are rejected and permissions are read from the database on each request', async (t) => {
  const server = await start(t);
  const signedIn = await login(server, 'staff2@lsbu.ac.uk');
  t.after(() => pool.query("UPDATE users SET active = true, role = 'staff' WHERE email = 'staff2@lsbu.ac.uk'"));
  await pool.query("UPDATE users SET role = 'manager' WHERE email = 'staff2@lsbu.ac.uk'");
  assert.equal((await rawRequest(server, '/api/v1/auth/me', credentials(signedIn))).body.user.role, 'manager');
  await pool.query("UPDATE users SET active = false WHERE email = 'staff2@lsbu.ac.uk'");
  assert.equal((await rawRequest(server, '/api/v1/auth/me', credentials(signedIn))).status, 401);
  const denied = await login(server, 'staff2@lsbu.ac.uk');
  assert.equal(denied.status, 401);
  assert.equal(denied.body.code, 'INVALID_CREDENTIALS');
});

test('password reset through seeding preserves the account and revokes its existing sessions', async (t) => {
  const server = await start(t);
  const signedIn = await login(server, 'staff@lsbu.ac.uk');
  const replacement = { ...testPasswords, DEMO_STAFF_PASSWORD: 'A-changed-test-password-2026' };
  t.after(() => seed(pool, testPasswords));
  await seed(pool, replacement);
  assert.equal((await rawRequest(server, '/api/v1/auth/me', credentials(signedIn))).status, 401);
  assert.equal((await login(server, 'staff@lsbu.ac.uk')).status, 401);
  const updated = await login(server, 'staff@lsbu.ac.uk', replacement.DEMO_STAFF_PASSWORD);
  assert.equal(updated.status, 200);
  assert.equal(updated.body.user.id, oldStaffId);
});

test('server enforces both inactivity and absolute expiry', async (t) => {
  let clock = Date.now();
  const server = await start(t, { now: () => clock, idleMs: 100000, absoluteMs: 300000 });
  const inactive = await login(server, 'staff@lsbu.ac.uk');
  clock += 100001;
  assert.equal((await rawRequest(server, '/api/v1/auth/me', credentials(inactive))).status, 401);
  const active = await login(server, 'staff@lsbu.ac.uk');
  for (let n = 0; n < 3; n++) {
    clock += 80000;
    assert.equal((await rawRequest(server, '/api/v1/auth/me', credentials(active))).status, 200);
  }
  clock += 60001;
  assert.equal((await rawRequest(server, '/api/v1/auth/me', credentials(active))).status, 401);
});

test('login rate limiting rejects repeated failures', async (t) => {
  const server = await start(t, { loginLimit: 2 });
  assert.equal((await login(server, 'staff@lsbu.ac.uk', 'Wrong')).status, 401);
  assert.equal((await login(server, 'staff@lsbu.ac.uk', 'Wrong')).status, 401);
  const denied = await login(server, 'staff@lsbu.ac.uk', 'Wrong');
  assert.equal(denied.status, 429);
  assert.equal(denied.body.code, 'TOO_MANY_ATTEMPTS');
});

test('the server refuses a missing or short session signing secret', () => {
  assert.throws(() => createApp(pool, { sessionSecret: '' }), /SESSION_SECRET/);
  assert.throws(() => createApp(pool, { sessionSecret: 'short' }), /SESSION_SECRET/);
});
