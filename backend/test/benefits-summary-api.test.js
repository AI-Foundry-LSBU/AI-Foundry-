import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { after, before, beforeEach, test } from 'node:test';
import pg from 'pg';
import { createApp } from '../src/app.js';
import { migrate, seed } from '../src/db/setup.js';
import { authenticatedRequest as request, sessionSecret, testPasswords } from '../test-support/client.js';

const manager = 'manager@lsbu.ac.uk';
const path = '/api/v1/benefits/summary';
const schema = `benefits_summary_${randomUUID().replaceAll('-', '')}`;
let admin;
let pool;
let schemaCreated = false;

before(async () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  assert.ok(connectionString, 'Set TEST_DATABASE_URL before running the integration tests.');
  admin = new pg.Pool({ connectionString, connectionTimeoutMillis: 5000 });
  await admin.query(`CREATE SCHEMA ${schema}`);
  schemaCreated = true;
  pool = new pg.Pool({ connectionString, max: 1, connectionTimeoutMillis: 5000,
    onConnect: (client) => client.query(`SET search_path TO ${schema}`) });
  assert.equal((await pool.query('SELECT current_schema() AS name')).rows[0].name, schema);
  await migrate(pool);
  await seed(pool, testPasswords);
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

async function start(t) {
  const app = createApp(pool, { sessionSecret, sessionSchema: schema, pruneSessionInterval: false });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    app.locals.sessionStore.close();
  });
  return server;
}

async function project(title, status = 'not_started') {
  const { rows: [saved] } = await pool.query(`
    WITH approved AS (
      INSERT INTO opportunities (submitted_by, title, department, problem_description, proposed_improvement, status)
      SELECT id, $1, 'Estates', 'Test problem', 'Test improvement', 'approved'
      FROM users WHERE email = 'staff@lsbu.ac.uk' RETURNING id
    )
    INSERT INTO projects (opportunity_id, created_by, status, progress)
    SELECT approved.id, users.id, $2, CASE WHEN $2 = 'completed' THEN 100 ELSE 0 END
    FROM approved CROSS JOIN users WHERE email = $3 RETURNING id`, [title, status, manager]);
  return saved.id;
}

function input(projectId, overrides = {}) {
  return {
    projectId, category: 'efficiency', description: 'Time saved booking rooms',
    measurement: 'Staff hours per month', estimated: 0.1, actual: 0.2,
    unit: 'Hours/month', date: '2026-11-18', notes: '', ...overrides
  };
}

async function save(server, body) {
  const response = await request(server, '/api/v1/benefits', { email: manager, body });
  assert.equal(response.status, 201);
  return response.body;
}
const total = (result, unit = 'Hours/month') => result.totals.find((item) => item.unit === unit);

test('US07 summary requires a manager session and cannot be impersonated with a header', async (t) => {
  const server = await start(t);
  assert.equal((await request(server, path)).status, 401);
  assert.equal((await request(server, path, { headers: { 'X-User-Email': manager } })).status, 401);
  for (const email of ['staff@lsbu.ac.uk', 'staff2@lsbu.ac.uk', 'engineer@lsbu.ac.uk']) {
    assert.equal((await request(server, path, { email })).status, 403);
  }
  const response = await request(server, path, { email: manager });
  assert.equal(response.status, 200); // Also verifies /summary precedes /:id.
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('US07 empty summary retains completed-project count without claiming benefits exist', async (t) => {
  const server = await start(t);
  await project('Completed without benefits', 'completed');
  const { body } = await request(server, path, { email: manager });
  assert.equal(body.completedProjects, 1);
  assert.equal(body.totalBenefitsRecorded, 0);
  assert.equal(body.projectCount, 0);
  assert.deepEqual(body.projects, []);
  assert.deepEqual(body.byCategory, []);
  assert.ok(body.totals.every((item) => item.estimated === '0.0000' && item.actual === '0.0000'));
  assert.equal(body.message, 'No benefits have been recorded yet.');
});

test('US07 totals count each saved benefit once despite equal values and multiple progress notes', async (t) => {
  const server = await start(t);
  const a = await project('Booking automation', 'completed');
  const b = await project('Invoice automation');
  for (const note of ['First update', 'Second update', 'Third update']) {
    await pool.query(`INSERT INTO project_progress_notes (project_id, author_id, body)
      SELECT $1, id, $2 FROM users WHERE email = $3`, [a, note, manager]);
  }
  await save(server, input(a));
  await save(server, input(a)); // Same values, different legitimate benefit IDs.
  await save(server, input(a, { unit: 'GBP/year', category: 'financial', estimated: 500, actual: 250.125 }));
  await save(server, input(b, { estimated: -0.1, actual: 0 }));
  await save(server, input(b, { unit: 'Cases/month', estimated: 20, actual: 10 }));
  const { body } = await request(server, path, { email: manager });
  assert.equal(body.totalBenefitsRecorded, 5);
  assert.equal(body.completedProjects, 1);
  assert.equal(body.projectCount, 2);
  assert.deepEqual(total(body), { unit: 'Hours/month', estimated: '0.1000', actual: '0.4000', benefitCount: 3 });
  assert.equal(total(body, 'GBP/year').actual, '250.1250');
  assert.equal(total(body, 'Cases/month').actual, '10.0000');
  assert.equal(total(body.projects.find((p) => p.projectId === a)).estimated, '0.2000');
  assert.deepEqual(body.byCategory, [{ category: 'efficiency', count: 4 }, { category: 'financial', count: 1 }]);
  assert.equal(body.message, null);
  assert.deepEqual((await request(server, path, { email: manager })).body, body);
});

test('US07 fresh summaries reflect edits and project reassignment without accumulating old values', async (t) => {
  const server = await start(t);
  const a = await project('First project');
  const b = await project('Second project');
  const saved = await save(server, input(a, { estimated: 10, actual: 5 }));
  assert.equal(total((await request(server, path, { email: manager })).body).estimated, '10.0000');
  const update = await request(server, `/api/v1/benefits/${saved.id}`, {
    email: manager, method: 'PUT', body: input(b, { unit: 'GBP/year', estimated: 15.125, actual: -2.0001 })
  });
  assert.equal(update.status, 200);
  const { body } = await request(server, path, { email: manager });
  assert.equal(body.totalBenefitsRecorded, 1);
  assert.equal(body.projectCount, 1);
  assert.equal(body.projects[0].projectId, b);
  assert.equal(body.projects[0].project, 'Second project');
  assert.equal(total(body).actual, '0.0000');
  assert.equal(total(body, 'GBP/year').estimated, '15.1250');
  assert.equal(total(body, 'GBP/year').actual, '-2.0001');
});

test('US07 percent and day measurements are returned separately at project level', async (t) => {
  const server = await start(t);
  const id = await project('Service improvements');
  const percent = await save(server, input(id, { unit: 'Percent', estimated: 40, actual: 25 }));
  const days = await save(server, input(id, { unit: 'Days', estimated: 4, actual: 2 }));
  const { body } = await request(server, path, { email: manager });
  assert.equal(body.totalBenefitsRecorded, 2);
  assert.equal(body.message, null);
  assert.ok(body.totals.every((item) => item.benefitCount === 0));
  const measures = body.projects[0].nonAdditiveBenefits;
  assert.equal(measures.length, 2);
  assert.equal(measures.find((item) => item.id === percent.id).actual, '25.0000');
  assert.equal(measures.find((item) => item.id === days.id).estimated, '4.0000');
  assert.equal(measures[0].date, '2026-11-18');
});
