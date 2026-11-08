import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { after, before, beforeEach, test } from 'node:test';
import express from 'express';
import pg from 'pg';
import { createApp } from '../src/app.js';
import { migrate, seed } from '../src/db/setup.js';
import { resolveDemoUser } from '../src/middleware/resolveDemoUser.js';

const staff = 'staff@example.com';
const otherStaff = 'staff2@example.com';
const manager = 'manager@example.com';
const team = 'team@example.com';
const submission = {
  title: 'Automate booking emails',
  department: 'Estates & Facilities',
  problemDescription: 'Staff manually confirm every room booking.',
  proposedImprovement: 'Send confirmations when a booking is approved.'
};
const schema = `foundry_test_${randomUUID().replaceAll('-', '')}`;
let admin;
let schemaCreated = false;
let pool;

before(async () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  assert.ok(connectionString, 'Set TEST_DATABASE_URL to a local PostgreSQL database before running tests.');
  admin = new pg.Pool({ connectionString, connectionTimeoutMillis: 5000 });
  await admin.query(`CREATE SCHEMA ${schema}`);
  schemaCreated = true;
  pool = new pg.Pool({
    connectionString,
    max: 1,
    onConnect: (client) => client.query(`SET search_path TO ${schema}`),
    connectionTimeoutMillis: 5000
  });
  const { rows } = await pool.query('SELECT current_schema() AS name');
  assert.equal(rows[0].name, schema, 'The integration test must use its isolated schema.');
  await migrate(pool);
  await seed(pool);
});

beforeEach(() => pool.query('TRUNCATE opportunities'));

after(async () => {
  try {
    await pool?.end();
    if (schemaCreated) await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  } finally {
    await admin?.end();
  }
});

async function listen(app) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server;
}

async function request(server, path, { email, method, body, rawBody, contentType = 'application/json' } = {}) {
  const headers = {};
  if (email !== undefined) headers['X-User-Email'] = email;
  if (body !== undefined || rawBody !== undefined) headers['Content-Type'] = contentType;

  const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
    method: method ?? (body !== undefined || rawBody !== undefined ? 'POST' : 'GET'),
    headers,
    body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body))
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
    headers: response.headers
  };
}

test('demo identity rejects missing, unknown and combined emails and resolves seeded roles', async (t) => {
  const app = express();
  app.get('/identity', resolveDemoUser(pool), (req, res) => res.json(req.user));
  const server = await listen(app);
  t.after(() => new Promise((resolve) => server.close(resolve)));

  for (const email of [undefined, '', 'unknown@example.com', `${staff},${manager}`]) {
    const result = await request(server, '/identity', { email });
    assert.equal(result.status, 401);
    assert.equal(result.body.code, 'UNAUTHORISED');
  }

  for (const [email, role] of [[staff.toUpperCase(), 'staff'], [otherStaff, 'staff'], [manager, 'manager'], [team, 'team']]) {
    const result = await request(server, '/identity', { email });
    assert.equal(result.status, 200);
    assert.equal(result.body.role, role);
    assert.ok(result.body.id);
  }
});

test('POST saves the submission with server-owned metadata and preserves expected benefits', async (t) => {
  const server = await listen(createApp(pool));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const { status, body, headers } = await request(server, '/api/v1/opportunities', {
    email: staff,
    body: {
      ...submission,
      title: `  ${submission.title}  `,
      expectedBenefits: '  Save one hour per week.  ',
      status: 'approved',
      submittedBy: { id: randomUUID(), name: 'Fake Owner' }
    }
  });

  assert.equal(status, 201);
  assert.equal(headers.get('location'), `/api/v1/opportunities/${body.id}`);
  assert.equal(body.title, submission.title);
  assert.equal(body.status, 'submitted');
  assert.equal(body.source, 'staff_submission');
  assert.equal(body.expectedBenefits, 'Save one hour per week.');
  assert.equal(body.submittedBy.name, 'Demo Staff');
  assert.equal(body.submittedAt, body.updatedAt);
  assert.equal(new Date(body.submittedAt).toISOString(), body.submittedAt);
  assert.equal(Object.hasOwn(body, 'hackathonName'), false);

  const { rows } = await pool.query(
    'SELECT submitted_by, expected_benefits FROM opportunities WHERE id = $1',
    [body.id]
  );
  assert.deepEqual(rows[0], {
    submitted_by: body.submittedBy.id,
    expected_benefits: body.expectedBenefits
  });
});

test('POST rejects invalid JSON, invalid fields and unknown identity', async (t) => {
  const server = await listen(createApp(pool));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const path = '/api/v1/opportunities';
  const invalid = await request(server, path, {
    email: staff,
    body: { title: ' ', department: 3, proposedImprovement: 'a'.repeat(2001), expectedBenefits: 'a'.repeat(501) }
  });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.code, 'VALIDATION_ERROR');
  assert.deepEqual(Object.keys(invalid.body.fields).sort(), [
    'department', 'expectedBenefits', 'problemDescription', 'proposedImprovement', 'title'
  ]);
  assert.equal((await request(server, path, { email: staff, rawBody: '{' })).status, 400);
  assert.equal((await request(server, path, { email: staff, body: [] })).status, 400);
  assert.equal((await request(server, path, { email: staff, body: { ...submission, source: null } })).status, 400);
  const tooLarge = await request(server, path, { email: staff, body: { ...submission, extra: 'a'.repeat(65536) } });
  assert.equal(tooLarge.status, 413);
  assert.equal(tooLarge.body.code, 'PAYLOAD_TOO_LARGE');
  const badCharset = await request(server, path, {
    email: staff, body: submission, contentType: 'application/json; charset=iso-8859-1'
  });
  assert.equal(badCharset.status, 415);
  assert.equal(badCharset.body.code, 'UNSUPPORTED_MEDIA_TYPE');
  assert.equal((await request(server, path, { body: submission })).status, 401);
});

test('POST applies source and role rules to ordinary and hackathon submissions', async (t) => {
  const server = await listen(createApp(pool));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const path = '/api/v1/opportunities';
  const hackathon = { ...submission, source: 'hackathon', hackathonName: 'Demo event' };
  for (const email of [manager, team]) {
    assert.equal((await request(server, path, { email, body: submission })).status, 403);
  }
  assert.equal((await request(server, path, { email: staff, body: hackathon })).status, 403);
  const saved = await request(server, path, { email: team, body: hackathon });
  assert.equal(saved.status, 201);
  assert.equal(saved.body.source, 'hackathon');
  assert.equal(saved.body.hackathonName, 'Demo event');
  assert.equal(saved.body.submittedBy.name, 'Demo Engineer');
});

test('GET My Opportunities lists only the caller’s submissions and includes new submissions immediately', async (t) => {
  const server = await listen(createApp(pool));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const path = '/api/v1/me/opportunities';

  const empty = await request(server, path, { email: staff });
  assert.equal(empty.status, 200);
  assert.deepEqual(empty.body, { items: [], page: 1, pageSize: 20, total: 0 });

  const mine = await request(server, '/api/v1/opportunities', { email: staff, body: submission });
  const theirs = await request(server, '/api/v1/opportunities', { email: otherStaff, body: submission });
  const page = await request(server, path, { email: staff });
  assert.equal(page.status, 200);
  assert.deepEqual(page.body, {
    items: [{
      id: mine.body.id,
      title: submission.title,
      department: submission.department,
      status: 'submitted',
      submittedAt: mine.body.submittedAt
    }],
    page: 1,
    pageSize: 20,
    total: 1
  });
  const theirPage = await request(server, path, { email: otherStaff });
  assert.deepEqual(theirPage.body.items.map(({ id }) => id), [theirs.body.id]);
  assert.equal((await request(server, path)).status, 401);
});

test('GET My Opportunities paginates and sorts, including unset priority and empty pages', async (t) => {
  const server = await listen(createApp(pool));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const path = '/api/v1/me/opportunities';

  const ids = {};
  for (const [title, priority, date] of [
    ['Low', 'low', '2026-11-01T10:00:00Z'],
    ['High', 'high', '2026-11-02T10:00:00Z'],
    ['Unset', null, '2026-11-03T10:00:00Z']
  ]) {
    const saved = await request(server, '/api/v1/opportunities', { email: staff, body: { ...submission, title } });
    assert.equal(saved.status, 201);
    ids[title] = saved.body.id;
    await pool.query('UPDATE opportunities SET priority = $1, submitted_at = $2 WHERE id = $3', [
      priority, date, saved.body.id
    ]);
  }

  const expectedOrder = {
    submittedAt: ['Low', 'High', 'Unset'],
    '-submittedAt': ['Unset', 'High', 'Low'],
    priority: ['Low', 'High', 'Unset'],
    '-priority': ['High', 'Low', 'Unset']
  };
  for (const [sort, titles] of Object.entries(expectedOrder)) {
    const result = await request(server, `${path}?sort=${sort}`, { email: staff });
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.items.map(({ title }) => title), titles);
    assert.equal(result.body.total, 3);
  }

  const second = await request(server, `${path}?page=2&pageSize=1`, { email: staff });
  assert.deepEqual(second.body.items.map(({ id }) => id), [ids.High]);
  assert.equal(second.body.page, 2);
  assert.equal(second.body.pageSize, 1);
  assert.equal(second.body.total, 3);

  const outOfRange = await request(server, `${path}?page=4&pageSize=1`, { email: staff });
  assert.deepEqual(outOfRange.body, { items: [], page: 4, pageSize: 1, total: 3 });
});

test('GET My Opportunities rejects invalid page, page size and sort', async (t) => {
  const server = await listen(createApp(pool));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const { status, body } = await request(
    server, '/api/v1/me/opportunities?page=0&pageSize=101&sort=constructor', { email: staff }
  );
  assert.equal(status, 400);
  assert.equal(body.code, 'VALIDATION_ERROR');
  assert.deepEqual(Object.keys(body.fields).sort(), ['page', 'pageSize', 'sort']);
});

test('GET opportunity details applies ownership and role rules', async (t) => {
  const server = await listen(createApp(pool));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const saved = await request(server, '/api/v1/opportunities', {
    email: staff,
    body: { ...submission, expectedBenefits: 'Save one hour per week.' }
  });
  assert.equal(saved.status, 201);
  const path = saved.headers.get('location');

  for (const email of [staff, manager, team]) {
    const detail = await request(server, path, { email });
    assert.equal(detail.status, 200);
    assert.deepEqual(detail.body, saved.body);
  }
  const forbidden = await request(server, path, { email: otherStaff });
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.body.code, 'FORBIDDEN');
  assert.equal((await request(server, path)).status, 401);
  for (const id of ['not-a-uuid', randomUUID()]) {
    const missing = await request(server, `/api/v1/opportunities/${id}`, { email: staff });
    assert.equal(missing.status, 404);
    assert.equal(missing.body.code, 'NOT_FOUND');
  }
});

test('DELETE removes only an opportunity owned by the caller', async (t) => {
  const server = await listen(createApp(pool));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const saved = await request(server, '/api/v1/opportunities', { email: staff, body: submission });
  const path = saved.headers.get('location');

  for (const email of [otherStaff, manager, team]) {
    const denied = await request(server, path, { method: 'DELETE', email });
    assert.equal(denied.status, 403);
    assert.equal(denied.body.code, 'FORBIDDEN');
  }
  assert.equal((await request(server, path, { email: staff })).status, 200);

  const deleted = await request(server, path, { method: 'DELETE', email: staff });
  assert.equal(deleted.status, 204);
  assert.equal(deleted.body, null);
  assert.equal((await request(server, path, { email: staff })).status, 404);

  for (const id of ['not-a-uuid', randomUUID()]) {
    const missing = await request(server, `/api/v1/opportunities/${id}`, { method: 'DELETE', email: staff });
    assert.equal(missing.status, 404);
    assert.equal(missing.body.code, 'NOT_FOUND');
  }
});

test('database setup can be rerun without replacing demo users or reapplying the initial migration', async () => {
  const before = (await pool.query('SELECT email, id FROM users ORDER BY email')).rows;
  await migrate(pool);
  await seed(pool);
  const after = (await pool.query('SELECT email, id FROM users ORDER BY email')).rows;
  assert.equal(before.length, 4);
  assert.deepEqual(after, before);
  const { rows } = await pool.query('SELECT filename FROM schema_migrations');
  assert.deepEqual(rows, [{ filename: '001_initial.sql' }]);
});
