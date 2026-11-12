import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { after, before, beforeEach, test } from 'node:test';
import pg from 'pg';
import { createApp as buildApp } from '../src/app.js';
import { migrate, seed as seedUsers } from '../src/db/setup.js';
import { authenticatedRequest as request, sessionSecret, testPasswords } from '../test-support/client.js';

const staff = 'staff@lsbu.ac.uk';
const otherStaff = 'staff2@lsbu.ac.uk';
const manager = 'manager@lsbu.ac.uk';
const team = 'engineer@lsbu.ac.uk';
const submission = {
  title: 'Automate booking emails',
  department: 'Estates & Facilities',
  problemDescription: 'Staff manually confirm every room booking.',
  proposedImprovement: 'Send confirmations when a booking is approved.'
};
const schema = `foundry_test_${randomUUID().replaceAll('-', '')}`;
const createApp = (pool) => buildApp(pool, { sessionSecret, sessionSchema: schema, pruneSessionInterval: false });
const seed = (pool) => seedUsers(pool, testPasswords);
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

beforeEach(() => pool.query('TRUNCATE opportunities, opportunity_assessments, opportunity_decisions, projects, project_progress_notes, project_benefits'));

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
  const { rows } = await pool.query('SELECT filename FROM schema_migrations ORDER BY filename');
  assert.deepEqual(rows.map(({ filename }) => filename), [
    '001_initial.sql', '002_opportunity_assessments.sql', '003_opportunity_decisions.sql', '004_project_delivery.sql', '005_project_benefits.sql', '006_authentication.sql'
  ]);
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

test('US04 creates one project from an approved opportunity and shares delivery updates', async (t) => {
  const server = await listen(createApp(pool));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const projects = '/api/v1/projects';
  const opportunity = await request(server, '/api/v1/opportunities', { email: staff, body: submission });
  const opportunityPath = opportunity.headers.get('location');
  const input = { opportunityId: opportunity.body.id, startDate: '2026-11-12', targetDate: '2026-12-01' };
  const create = (email, body = input) => request(server, projects, { email, body });

  assert.deepEqual((await request(server, projects, { email: team })).body, []);
  assert.equal((await request(server, projects)).status, 401);
  assert.equal((await request(server, projects, { email: staff })).status, 403);
  assert.equal((await create(team)).status, 403);
  assert.equal((await create(manager, { ...input, opportunityId: randomUUID() })).status, 404);
  assert.equal((await create(manager, { ...input, startDate: '2026-02-30' })).status, 400);
  assert.equal((await create(manager, { ...input, targetDate: '2026-11-11' })).status, 400);
  assert.equal((await create(manager)).status, 409);

  assert.equal((await request(server, `${opportunityPath}/assessment`, {
    email: manager, method: 'PUT',
    body: { strategicAlignment: 4, benefitPotential: 4, complexity: 3, resourceRequirements: 2, speedToValue: 5, priority: 'high' }
  })).status, 200);
  assert.equal((await request(server, `${opportunityPath}/decision`, {
    email: manager, body: { decision: 'approved', reason: 'Ready for delivery.' }
  })).status, 200);
  assert.deepEqual((await request(server, projects, { email: team })).body, []);

  const created = await create(manager);
  assert.equal(created.status, 201);
  const path = created.headers.get('location');
  assert.equal(created.body.status, 'not_started');
  assert.equal(created.body.progress, 0);
  assert.equal(created.body.description, submission.proposedImprovement);
  assert.equal(created.body.priority, 'high');
  assert.equal(created.body.startDate, input.startDate);
  assert.equal(created.body.targetDate, input.targetDate);
  assert.deepEqual(created.body.notes, []);
  assert.equal((await create(manager)).status, 409);
  assert.equal((await request(server, projects, { email: team })).body[0].id, created.body.id);
  assert.equal((await request(server, opportunityPath, { email: manager })).body.projectId, created.body.id);
  assert.equal((await request(server, path, { email: staff })).status, 403);
  assert.equal((await request(server, path, { email: team })).status, 200);
  assert.equal((await request(server, `${projects}/bad-id`, { email: team })).status, 404);

  const patch = (email, body) => request(server, path, { email, method: 'PATCH', body });
  assert.equal((await patch(staff, { status: 'testing' })).status, 403);
  for (const invalid of [{}, { status: 'approved' }, { progress: 101 }, { note: '   ' }]) {
    assert.equal((await patch(team, invalid)).status, 400);
  }
  assert.equal((await patch(team, { status: 'in_progress', progress: 25, note: '  Built the first workflow.  ' })).status, 200);
  assert.equal((await patch(team, { status: 'testing', note: 'Testing with the service team.' })).status, 200);

  const ownerView = await request(server, opportunityPath, { email: staff });
  assert.equal(ownerView.body.status, 'approved');
  assert.equal(ownerView.body.decision.decision, 'approved');
  assert.equal(ownerView.body.deliveryStatus, 'testing');
  assert.equal(ownerView.body.notes, undefined);
  const ownerList = await request(server, '/api/v1/me/opportunities', { email: staff });
  assert.equal(ownerList.body.items[0].deliveryStatus, 'testing');
  assert.equal((await request(server, opportunityPath, { email: otherStaff })).status, 403);

  const managerView = await request(server, path, { email: manager });
  assert.equal(managerView.body.status, 'testing');
  assert.equal(managerView.body.progress, 25);
  assert.deepEqual(managerView.body.notes.map(({ text, author }) => ({ text, author })), [
    { text: 'Testing with the service team.', author: 'Demo Engineer' },
    { text: 'Built the first workflow.', author: 'Demo Engineer' }
  ]);
  assert.ok(managerView.body.notes.every((note) => note.id && Number.isFinite(Date.parse(note.createdAt))));
  assert.equal((await patch(team, { note: 'Waiting for feedback.' })).body.status, 'testing');
  const completed = await patch(team, { status: 'completed' });
  assert.equal(completed.body.progress, 100);
  assert.equal(completed.body.notes.length, 3);
  assert.equal((await request(server, projects, { email: manager })).body[0].status, 'completed');

  const deletion = await request(server, opportunityPath, { email: staff, method: 'DELETE' });
  assert.equal(deletion.status, 409);
  assert.equal(deletion.body.code, 'PROJECT_EXISTS');
  assert.equal((await request(server, opportunityPath, { email: staff })).body.status, 'approved');
  assert.equal((await request(server, path, { email: manager })).body.notes.length, 3);
});

async function benefitProject(title) {
  const { rows } = await pool.query(
    `WITH approved AS (
       INSERT INTO opportunities (
         submitted_by, title, department, problem_description, proposed_improvement, status
       )
       SELECT id, $1, 'Estates', 'Test issue', 'Test improvement', 'approved'
       FROM users WHERE email = $2
       RETURNING id
     )
     INSERT INTO projects (opportunity_id, created_by)
     SELECT approved.id, users.id FROM approved CROSS JOIN users WHERE users.email = $3
     RETURNING id`,
    [title, staff, manager]
  );
  return rows[0].id;
}

test('US05 managers create and edit persistent benefits linked to real projects', async (t) => {
  const server = await listen(createApp(pool));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const projectId = await benefitProject('First benefits project');
  const nextProjectId = await benefitProject('Second benefits project');
  const input = {
    projectId, category: 'efficiency', description: 'Less administration.',
    measurement: 'Staff hours saved', estimated: 12.5, actual: 0,
    unit: 'Hours/month', date: '2026-11-11', notes: 'Pilot estimate.'
  };
  const list = (email, suffix = '') => request(server, `/api/v1/benefits${suffix}`, { email });
  assert.deepEqual((await list(manager)).body, []);
  assert.equal((await list()).status, 401);
  assert.equal((await list(staff)).status, 403);
  for (const email of [undefined, staff, team]) {
    assert.equal((await request(server, '/api/v1/benefits', { email, body: input })).status, email ? 403 : 401);
  }

  const created = await request(server, '/api/v1/benefits', { email: manager, body: input });
  assert.equal(created.status, 201);
  assert.equal(created.body.project, 'First benefits project');
  assert.equal(created.body.actual, 0);
  assert.equal(created.body.estimated, 12.5);
  assert.equal(created.body.date, '2026-11-11');
  assert.ok(Number.isFinite(Date.parse(created.body.createdAt)));
  const path = created.headers.get('location');
  assert.equal(path, `/api/v1/benefits/${created.body.id}`);
  assert.deepEqual((await request(server, path, { email: manager })).body, created.body);
  assert.deepEqual((await list(team, `?projectId=${projectId}`)).body, [created.body]);
  assert.deepEqual((await list(manager, `?projectId=${nextProjectId}`)).body, []);
  assert.equal((await list(manager, '?projectId=bad-id')).status, 400);

  for (const email of [undefined, staff]) {
    assert.equal((await request(server, path, { email })).status, email ? 403 : 401);
  }
  for (const email of [undefined, staff, team]) {
    assert.equal((await request(server, path, { email, method: 'PUT', body: input })).status, email ? 403 : 401);
  }

  const edit = {
    ...input, projectId: nextProjectId, category: 'financial', description: 'Updated savings.',
    measurement: 'Annual saving', estimated: 0, actual: -25.125,
    unit: 'GBP/year', date: '2026-11-12', notes: ''
  };
  const updated = await request(server, path, { email: manager, method: 'PUT', body: edit });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.id, created.body.id);
  assert.equal(updated.body.createdAt, created.body.createdAt);
  assert.equal(updated.body.project, 'Second benefits project');
  assert.equal(updated.body.estimated, 0);
  assert.equal(updated.body.actual, -25.125);
  assert.equal(updated.body.notes, '');
  assert.equal(updated.body.date, '2026-11-12');
  assert.deepEqual((await request(server, path, { email: manager })).body, updated.body);
  assert.deepEqual((await list(team, `?projectId=${projectId}`)).body, []);
  assert.deepEqual((await list(manager, `?projectId=${nextProjectId}`)).body, [updated.body]);
  const { rows: [stored] } = await pool.query(
    `SELECT b.*, u.name AS author FROM project_benefits b JOIN users u ON u.id = b.updated_by WHERE b.id = $1`,
    [created.body.id]
  );
  assert.equal(stored.actual, '-25.1250');
  assert.equal(stored.author, 'Demo Manager');
});

test('US05 rejects invalid benefit fields and missing records without losing a saved benefit', async (t) => {
  const server = await listen(createApp(pool));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const projectId = await benefitProject('Validation project');
  const input = {
    projectId, category: 'service', description: 'Faster turnaround.',
    measurement: 'Processing days saved', estimated: 2.25, actual: 1.125,
    unit: 'Days', date: '2026-11-11'
  };
  const send = (body, path = '/api/v1/benefits', method = 'POST') =>
    request(server, path, { email: manager, body, method });
  for (const fields of [
    { description: ' ' }, { measurement: '' }, { category: 'unknown' }, { unit: 'minutes' },
    { estimated: '2.25' }, { actual: null }, { actual: 1e20 }, { actual: 0.00001 },
    { date: '2026-02-30' }, { date: '11/11/2026' }, { notes: '\0' },
    { projectId: 'not-a-uuid' }, { description: 'a'.repeat(2001) }
  ]) {
    const response = await send({ ...input, ...fields });
    assert.equal(response.status, 400);
    assert.equal(response.body.code, 'VALIDATION_ERROR');
    assert.ok(Object.keys(response.body.fields).length);
  }
  assert.equal((await send([])).status, 400);
  assert.equal((await send({ ...input, projectId: randomUUID() })).status, 404);
  const created = await send(input);
  assert.equal(created.status, 201);
  assert.equal(created.body.notes, '');
  const path = created.headers.get('location');

  assert.equal((await send({ ...input, actual: 'invalid' }, path, 'PUT')).status, 400);
  assert.equal((await send({ ...input, projectId: randomUUID() }, path, 'PUT')).status, 404);
  assert.deepEqual((await request(server, path, { email: manager })).body, created.body);
  assert.equal((await send(input, `/api/v1/benefits/${randomUUID()}`, 'PUT')).status, 404);
  assert.equal((await request(server, '/api/v1/benefits/bad-id', { email: manager })).status, 404);
});

test('US06 manager responses support combined filters, pagination and delivery display data', async (t) => {
  const server = await listen(createApp(pool));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const path = '/api/v1/opportunities';
  const records = [];
  for (const [title, department, priority] of [
    ['Invoice West', 'Finance', 'high'],
    ['Archive West', 'Finance', 'low'],
    ['Invoice East', 'Student Services', 'high'],
    ['New submission', 'Finance', undefined]
  ]) {
    const created = await request(server, path, { email: staff, body: { ...submission, title, department } });
    assert.equal(created.status, 201);
    records.push(created.body);
    if (priority) {
      assert.equal((await request(server, `${path}/${created.body.id}/assessment`, {
        email: manager, method: 'PUT',
        body: { strategicAlignment: 4, benefitPotential: 4, complexity: 3, resourceRequirements: 2, speedToValue: 5, priority }
      })).status, 200);
    }
  }
  const list = (query = '') => request(server, `${path}${query}`, { email: manager });
  const all = await list();
  assert.equal(all.body.total, 4);
  for (const item of all.body.items) {
    assert.equal(typeof item.title, 'string');
    assert.equal(typeof item.department, 'string');
    assert.equal(typeof item.status, 'string');
    assert.ok(item.id);
  }
  assert.equal(all.body.items.find((item) => item.id === records[3].id).priority, undefined);
  assert.equal((await list('?department=Finance')).body.total, 3);
  assert.equal((await list('?priority=high')).body.total, 2);
  assert.equal((await list('?status=in_assessment')).body.total, 3);
  const combined = await list('?department=Finance&priority=high&status=in_assessment');
  assert.equal(combined.status, 200);
  assert.deepEqual(combined.body.items.map((item) => item.id), [records[0].id]);
  const page2 = await list('?priority=high&pageSize=1&page=2');
  assert.equal(page2.body.total, 2);
  assert.equal(page2.body.items.length, 1);
  assert.equal((await list('?department=Finance&priority=medium')).body.total, 0);
  assert.deepEqual((await list('?department=Finance&priority=medium')).body.items, []);

  assert.equal((await request(server, `${path}/${records[1].id}/decision`, {
    email: manager, body: { decision: 'approved', reason: 'Ready for delivery.' }
  })).status, 200);
  const project = await request(server, '/api/v1/projects', {
    email: manager, body: { opportunityId: records[1].id }
  });
  assert.equal(project.status, 201);
  assert.equal((await request(server, project.headers.get('location'), {
    email: team, method: 'PATCH', body: { status: 'testing' }
  })).status, 200);
  const delivery = await list('?status=approved&department=Finance&priority=low');
  assert.equal(delivery.body.total, 1);
  assert.equal(delivery.body.items[0].status, 'approved');
  assert.equal(delivery.body.items[0].deliveryStatus, 'testing');
  assert.equal((await list('?priority=urgent')).status, 400);
  assert.equal((await list('?department=Finance&department=Student%20Services')).status, 400);
  assert.equal((await list()).body.total, 4);
});
