import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { after, before, beforeEach, test } from 'node:test';
import pg from 'pg';
import { createApp } from '../src/app.js';
import { migrate, seed } from '../src/db/setup.js';
import { authenticatedRequest as request, sessionSecret, testPasswords } from '../test-support/client.js';

const staff = 'staff@lsbu.ac.uk';
const manager = 'manager@lsbu.ac.uk';
const engineer = 'engineer@lsbu.ac.uk';
const schema = `history_api_${randomUUID().replaceAll('-', '')}`;
const submission = {
  title: 'Automate booking emails', department: 'Estates',
  problemDescription: 'Manual emails', proposedImprovement: 'Automate confirmations'
};
const assessment = {
  priority: 'high', strategicAlignment: 5, benefitPotential: 4,
  complexity: 3, resourceRequirements: 2, speedToValue: 5
};
let admin;
let pool;
let created = false;

before(async () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  assert.ok(connectionString, 'Set TEST_DATABASE_URL before running integration tests.');
  admin = new pg.Pool({ connectionString });
  await admin.query(`CREATE SCHEMA ${schema}`);
  created = true;
  pool = new pg.Pool({ connectionString, max: 1,
    onConnect: (client) => client.query(`SET search_path TO ${schema}`) });
  assert.equal((await pool.query('SELECT current_schema() AS name')).rows[0].name, schema);
  await migrate(pool);
  await seed(pool, testPasswords);
});
beforeEach(() => pool.query('TRUNCATE opportunities CASCADE'));
after(async () => {
  try {
    await pool?.end();
    if (created) await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  } finally { await admin?.end(); }
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
const path = (id) => `/api/v1/opportunities/${id}/history`;
const getHistory = (server, id) => request(server, path(id), { email: manager });
async function submit(server, extra = {}) {
  const result = await request(server, '/api/v1/opportunities', { email: staff, body: { ...submission, ...extra } });
  assert.equal(result.status, 201);
  return result.body;
}
async function review(server, id) {
  assert.equal((await request(server, `/api/v1/opportunities/${id}/assessment`, {
    email: manager, method: 'PUT', body: assessment
  })).status, 200);
}

test('US08 history is manager-only, including when staff own the opportunity', async (t) => {
  const server = await start(t);
  const opportunity = await submit(server, {
    actor: { name: 'Impersonated manager' }, occurredAt: '1900-01-01T00:00:00Z',
    history: [{ eventType: 'decision_recorded', toStatus: 'approved' }]
  });
  assert.equal((await request(server, path(opportunity.id))).status, 401);
  assert.equal((await request(server, path(opportunity.id), { headers: { 'X-User-Email': manager } })).status, 401);
  for (const email of [staff, 'staff2@lsbu.ac.uk', engineer]) {
    assert.equal((await request(server, path(opportunity.id), { email })).status, 403);
    assert.equal((await request(server, path(randomUUID()), { email })).status, 403);
  }
  const result = await getHistory(server, opportunity.id);
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('cache-control'), 'no-store');
  assert.equal(result.body.items.length, 1);
  assert.equal(result.body.items[0].actor.name, 'Demo Staff');
  assert.equal(result.body.items[0].occurredAt, opportunity.submittedAt);
});

test('US08 returns a persistent chronological timeline for only the selected opportunity', async (t) => {
  const server = await start(t);
  const opportunity = await submit(server);
  await submit(server, { title: 'Another request' });
  await review(server, opportunity.id);
  await review(server, opportunity.id); // Saving the same status adds no transition.
  const decision = await request(server, `/api/v1/opportunities/${opportunity.id}/decision`, {
    email: manager, body: { decision: 'approved', reason: '  Saves administration time.  ' }
  });
  assert.equal(decision.status, 200);
  const result = await getHistory(server, opportunity.id);
  assert.equal(result.body.opportunityId, opportunity.id);
  assert.deepEqual(result.body.items.map((item) => [item.eventType, item.fromStatus, item.toStatus]), [
    ['submitted', null, 'submitted'], ['status_changed', 'submitted', 'in_assessment'],
    ['decision_recorded', 'in_assessment', 'approved']
  ]);
  assert.ok(result.body.items.every((item) => typeof item.id === 'string' && /^\d+$/.test(item.id)));
  assert.ok(result.body.items.every((item) => item.statusType === 'opportunity' && item.source === 'live'));
  assert.equal(result.body.items[2].reason, 'Saves administration time.');
  assert.equal(result.body.items[2].actor.id, decision.body.decision.decidedBy.id);
  assert.equal(result.body.items[2].occurredAt, new Date(decision.body.decision.decidedAt).toISOString());
  const dates = result.body.items.map((item) => Date.parse(item.occurredAt));
  assert.deepEqual(dates, [...dates].sort((a, b) => a - b));
  assert.deepEqual((await getHistory(server, opportunity.id)).body, result.body);
  const restarted = await start(t);
  assert.deepEqual((await getHistory(restarted, opportunity.id)).body, result.body);
});

test('US08 records rejection reasons and leaves history unchanged after an invalid decision', async (t) => {
  const server = await start(t);
  const opportunity = await submit(server);
  await review(server, opportunity.id);
  const decisionPath = `/api/v1/opportunities/${opportunity.id}/decision`;
  assert.equal((await request(server, decisionPath, { email: manager, body: { decision: 'rejected', reason: ' ' } })).status, 400);
  assert.equal((await getHistory(server, opportunity.id)).body.items.length, 2);
  assert.equal((await request(server, decisionPath, {
    email: manager, body: { decision: 'rejected', reason: 'Already covered.' }
  })).status, 200);
  const entry = (await getHistory(server, opportunity.id)).body.items.at(-1);
  assert.equal(entry.toStatus, 'rejected');
  assert.equal(entry.reason, 'Already covered.');
  assert.equal(entry.actor.name, 'Demo Manager');
});

test('US08 exposes delivery events with the engineer as actor, separately from approval', async (t) => {
  const server = await start(t);
  const opportunity = await submit(server);
  await review(server, opportunity.id);
  await request(server, `/api/v1/opportunities/${opportunity.id}/decision`, { email: manager, body: { decision: 'approved' } });
  const project = await request(server, '/api/v1/projects', { email: manager, body: { opportunityId: opportunity.id } });
  assert.equal(project.status, 201);
  assert.equal((await request(server, `/api/v1/projects/${project.body.id}`, {
    email: engineer, method: 'PATCH', body: { status: 'testing', note: 'Ready for testing.' }
  })).status, 200);
  const entries = (await getHistory(server, opportunity.id)).body.items;
  assert.deepEqual(entries.slice(-2).map((item) => [item.eventType, item.statusType, item.toStatus]), [
    ['delivery_started', 'delivery', 'not_started'], ['delivery_status_changed', 'delivery', 'testing']
  ]);
  assert.equal(entries.at(-1).actor.name, 'Demo Engineer');
  assert.equal(entries.at(-1).fromStatus, 'not_started');
  assert.equal(entries.at(-1).reason, null);
  assert.equal((await request(server, `/api/v1/opportunities/${opportunity.id}`, { email: manager })).body.status, 'approved');
});

test('US08 has no API for adding, editing or deleting history entries', async (t) => {
  const server = await start(t);
  const opportunity = await submit(server);
  const before = (await getHistory(server, opportunity.id)).body;
  const entryId = before.items[0].id;
  for (const target of [path(opportunity.id), `${path(opportunity.id)}/${entryId}`]) {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      assert.equal((await request(server, target, {
        email: manager, method, body: { reason: 'Rewrite history.', toStatus: 'approved' }
      })).status, 404);
    }
  }
  assert.deepEqual((await getHistory(server, opportunity.id)).body, before);
});

test('US08 distinguishes an empty timeline from a missing or malformed opportunity', async (t) => {
  const server = await start(t);
  // An externally imported row has no automatic API event yet.
  const { rows: [row] } = await pool.query(`INSERT INTO opportunities
    (submitted_by, title, department, problem_description, proposed_improvement)
    SELECT id, 'Imported request', 'Estates', 'Issue', 'Improvement' FROM users WHERE email = $1 RETURNING id`, [staff]);
  assert.deepEqual((await getHistory(server, row.id)).body, { opportunityId: row.id, items: [] });
  for (const id of [randomUUID(), 'bad-id', encodeURIComponent("' OR true --")]) {
    const missing = await getHistory(server, id);
    assert.equal(missing.status, 404);
    assert.equal(missing.body.code, 'NOT_FOUND');
  }
});

test('US08 sorts by actual event date and then stable ID when timestamps are identical', async (t) => {
  const server = await start(t);
  const opportunity = await submit(server);
  const ids = [];
  for (const timestamp of ['2026-11-03T10:00:00Z', '2026-11-01T10:00:00Z', '2026-11-01T10:00:00Z']) {
    const result = await pool.query(`INSERT INTO opportunity_history
      (opportunity_id, event_type, to_status, actor_id, actor_name, occurred_at, source)
      SELECT $1, 'submitted', 'submitted', id, name, $2, 'backfill' FROM users WHERE email = $3 RETURNING id`,
    [opportunity.id, timestamp, staff]);
    ids.push(result.rows[0].id);
  }
  const { body } = await getHistory(server, opportunity.id);
  assert.deepEqual(body.items.slice(0, 3).map((item) => item.id), [ids[1], ids[2], ids[0]]);
  assert.ok(body.items.slice(0, 3).every((item) => item.source === 'backfill'));
});
