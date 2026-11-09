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

beforeEach(() => pool.query('TRUNCATE opportunities, opportunity_assessments, opportunity_decisions'));

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

async function request(server, path, { email, body, rawBody, method, contentType = 'application/json' } = {}) {
  const headers = {};
  if (email !== undefined) headers['X-User-Email'] = email;
  if (body !== undefined || rawBody !== undefined) headers['Content-Type'] = contentType;

  const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
    method: method ?? (body !== undefined || rawBody !== undefined ? 'POST' : 'GET'),
    headers,
    body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body))
  });
  return { status: response.status, body: await response.json(), headers: response.headers };
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

test('database setup can be rerun without replacing demo users or reapplying the initial migration', async () => {
  const before = (await pool.query('SELECT email, id FROM users ORDER BY email')).rows;
  await migrate(pool);
  await seed(pool);
  const after = (await pool.query('SELECT email, id FROM users ORDER BY email')).rows;
  assert.equal(before.length, 4);
  assert.deepEqual(after, before);
  const { rows } = await pool.query('SELECT filename FROM schema_migrations ORDER BY filename');
  assert.deepEqual(rows, [{ filename: '001_initial.sql' }, { filename: '002_opportunity_assessments.sql' }, { filename: '003_opportunity_decisions.sql' }]);
});

test('only managers and team members can list all opportunities with filters and pagination', async (t) => {
  const server = await listen(createApp(pool));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const path = '/api/v1/opportunities';
  const first = await request(server, path, { email: staff, body: submission });
  const second = await request(server, path, { email: otherStaff, body: { ...submission, department: 'Library' } });
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);

  assert.equal((await request(server, path)).status, 401);
  assert.equal((await request(server, path, { email: staff })).status, 403);
  const all = await request(server, `${path}?pageSize=1`, { email: manager });
  assert.equal(all.status, 200);
  assert.equal(all.body.total, 2);
  assert.equal(all.body.items.length, 1);

  const filtered = await request(server, `${path}?department=Library&status=submitted`, { email: team });
  assert.equal(filtered.status, 200);
  assert.equal(filtered.body.total, 1);
  assert.equal(filtered.body.items[0].id, second.body.id);
  assert.deepEqual(filtered.body.items[0].submittedBy, second.body.submittedBy);
  assert.equal((await request(server, `${path}?status=bad`, { email: manager })).status, 400);
});

test('managers can save and replace assessments and owners can see the persisted status', async (t) => {
  const server = await listen(createApp(pool));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = '/api/v1/opportunities';
  const created = await request(server, base, { email: staff, body: submission });
  assert.equal(created.status, 201);
  const detail = `${base}/${created.body.id}`;
  const path = `${detail}/assessment`;
  const ratings = { strategicAlignment: 5, benefitPotential: 4, complexity: 3, resourceRequirements: 2, speedToValue: 1 };
  const assessment = { ...ratings, priority: 'high', category: 'automation', notes: 'Proceed to review.' };
  const put = (email, body, url = path) => request(server, url, { email, body, method: 'PUT' });

  assert.equal((await put(staff, assessment)).status, 403);
  assert.equal((await put(team, assessment)).status, 403);
  assert.equal((await put(manager, { ...assessment, complexity: 6 })).status, 400);
  assert.equal((await put(manager, assessment, `${base}/${randomUUID()}/assessment`)).status, 404);

  const saved = await put(manager, assessment);
  assert.equal(saved.status, 200);
  assert.equal(saved.body.status, 'in_assessment');
  assert.equal(saved.body.assessment.priority, 'high');
  assert.equal(saved.body.assessment.notes, assessment.notes);
  assert.equal(saved.body.assessment.assessedBy.name, 'Demo Manager');

  const filtered = await request(server, `${base}?category=automation&priority=high&status=in_assessment`, { email: manager });
  assert.equal(filtered.body.items[0].id, created.body.id);

  const replaced = await put(manager, { ...ratings, priority: 'low' });
  assert.equal(replaced.status, 200);
  const ownerView = await request(server, detail, { email: staff });
  assert.equal(ownerView.body.status, 'in_assessment');
  assert.equal(ownerView.body.assessment.priority, 'low');
  assert.equal(ownerView.body.assessment.category, undefined);
  assert.equal(ownerView.body.assessment.notes, undefined);
  assert.equal((await request(server, detail, { email: otherStaff })).status, 403);
});

test('only managers can record a decision, and decisions persist with the owner-visible status and reason', async (t) => {
  const server = await listen(createApp(pool));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const path = '/api/v1/opportunities';
  const assessment = { strategicAlignment: 5, benefitPotential: 4, complexity: 3, resourceRequirements: 2, speedToValue: 1, priority: 'high' };

  const create = () => request(server, path, { email: staff, body: submission });
  const assess = (id) => request(server, `${path}/${id}/assessment`, { email: manager, body: assessment, method: 'PUT' });
  const decide = (id, email, decision, reason) => request(server, `${path}/${id}/decision`, { email, body: { decision, reason } });
  const details = (id, email) => request(server, `${path}/${id}`, { email });

  const first = await create();
  assert.equal(first.status, 201);
  const approvedId = first.body.id;
  assert.equal((await decide(approvedId, manager, 'approved')).status, 409);
  assert.equal((await assess(approvedId)).status, 200);
  assert.equal((await decide(approvedId, undefined, 'approved')).status, 401);
  assert.equal((await decide(approvedId, staff, 'approved')).status, 403);
  assert.equal((await decide(approvedId, team, 'approved')).status, 403);
  assert.equal((await decide(randomUUID(), manager, 'approved')).status, 404);
  assert.equal((await decide(approvedId, manager, 'invalid')).status, 400);

  const approved = await decide(approvedId, manager, 'approved', 'Saves staff time.');
  assert.equal(approved.status, 200);
  assert.equal(approved.body.status, 'approved');
  assert.equal(approved.body.decision.reason, 'Saves staff time.');
  assert.equal(approved.body.decision.decidedBy.name, 'Demo Manager');
  assert.equal(approved.body.assessment.priority, 'high');
  assert.equal((await decide(approvedId, manager, 'rejected', 'Trying again.')).status, 409);
  assert.deepEqual((await details(approvedId, staff)).body.decision, approved.body.decision);
  assert.equal((await details(approvedId, otherStaff)).status, 403);
  assert.deepEqual((await assess(approvedId)).body.decision, approved.body.decision);

  const second = await create();
  const rejectedId = second.body.id;
  assert.equal((await assess(rejectedId)).status, 200);
  const noReason = await decide(rejectedId, manager, 'rejected', '  ');
  assert.equal(noReason.status, 400);
  assert.ok(noReason.body.fields.reason);

  const rejected = await decide(rejectedId, manager, 'rejected', 'Already covered.');
  assert.equal(rejected.status, 200);
  assert.equal(rejected.body.status, 'rejected');
  const ownerView = await details(rejectedId, staff);
  assert.equal(ownerView.body.status, 'rejected');
  assert.equal(ownerView.body.decision.reason, 'Already covered.');
  assert.equal((await request(server, `${path}?status=rejected`, { email: manager })).body.items[0].id, rejectedId);
});
