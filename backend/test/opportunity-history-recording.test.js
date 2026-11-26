import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import pg from 'pg';
import { migrate, seed } from '../src/db/setup.js';
import { insertOpportunity, saveAssessment, saveDecision } from '../src/opportunities/queries.js';
import { createProject, updateProject } from '../src/projects/queries.js';
import { testPasswords } from '../test-support/client.js';

const schema = `history_recording_${randomUUID().replaceAll('-', '')}`;
const submission = {
  title: 'Automate booking emails', department: 'Estates', problemDescription: 'Manual emails',
  proposedImprovement: 'Automate confirmations', source: 'staff_submission'
};
const assessment = {
  priority: 'high', category: 'automation', strategicAlignment: 5, benefitPotential: 4,
  complexity: 3, resourceRequirements: 2, speedToValue: 5, notes: 'Worth reviewing.'
};
let admin;
let pool;
let created = false;
let users;

before(async () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  assert.ok(connectionString, 'Set TEST_DATABASE_URL before running integration tests.');
  admin = new pg.Pool({ connectionString });
  await admin.query(`CREATE SCHEMA ${schema}`);
  created = true;
  pool = new pg.Pool({ connectionString, max: 4,
    onConnect: (client) => client.query(`SET search_path TO ${schema}`) });
  assert.equal((await pool.query('SELECT current_schema() AS name')).rows[0].name, schema);
  await migrate(pool);
  await seed(pool, testPasswords);
  users = Object.fromEntries((await pool.query('SELECT id, role FROM users')).rows.map((user) => [user.role, user.id]));
  users.staff = (await pool.query("SELECT id FROM users WHERE email = 'staff@lsbu.ac.uk'")).rows[0].id;
});
beforeEach(() => pool.query('TRUNCATE opportunities CASCADE'));
after(async () => {
  try {
    await pool?.end();
    if (created) await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  } finally { await admin?.end(); }
});

const submit = () => insertOpportunity(pool, users.staff, submission);
const assess = (id, data = assessment) => saveAssessment(pool, id, users.manager, data);
const decide = (id, decision = 'approved', reason = 'Ready for delivery.') =>
  saveDecision(pool, id, users.manager, { decision, reason });
const history = async (id) => (await pool.query(
  'SELECT * FROM opportunity_history WHERE opportunity_id = $1 ORDER BY occurred_at, id', [id]
)).rows;
async function reviewed() {
  const opportunity = await submit();
  await assess(opportunity.id);
  return opportunity.id;
}
async function approved() {
  const id = await reviewed();
  await decide(id);
  return id;
}

test('US08 records submission, first review transition and decision with actors and reasons', async () => {
  const opportunity = await submit();
  await assess(opportunity.id);
  await assess(opportunity.id, { ...assessment, priority: 'low', notes: 'Updated assessment.' });
  await decide(opportunity.id, 'rejected', 'Already covered by another service.');
  const entries = await history(opportunity.id);
  assert.deepEqual(entries.map(({ event_type, from_status, to_status }) => [event_type, from_status, to_status]), [
    ['submitted', null, 'submitted'],
    ['status_changed', 'submitted', 'in_assessment'],
    ['decision_recorded', 'in_assessment', 'rejected']
  ]);
  assert.equal(entries[0].actor_id, users.staff);
  assert.equal(entries[0].actor_name, 'Demo Staff');
  assert.equal(entries[0].occurred_at.toISOString(), opportunity.submitted_at.toISOString());
  assert.ok(entries.slice(1).every((entry) => entry.actor_id === users.manager && entry.actor_name === 'Demo Manager'));
  assert.equal(entries[2].reason, 'Already covered by another service.');
  assert.ok(entries.every((entry) => entry.source === 'live' && Number.isFinite(entry.occurred_at.getTime())));
  const before = entries.map((entry) => entry.id);
  assert.equal(await decide(opportunity.id, 'approved', 'Overwrite attempt'), undefined);
  assert.deepEqual((await history(opportunity.id)).map((entry) => entry.id), before);
});

test('US08 preserves an approval reason and snapshots the responsible user name', async () => {
  const id = await approved();
  await pool.query("UPDATE users SET name = 'Renamed Manager' WHERE id = $1", [users.manager]);
  try {
    const decision = (await history(id)).find((entry) => entry.event_type === 'decision_recorded');
    assert.equal(decision.to_status, 'approved');
    assert.equal(decision.reason, 'Ready for delivery.');
    assert.equal(decision.actor_name, 'Demo Manager');
  } finally {
    await pool.query("UPDATE users SET name = 'Demo Manager' WHERE id = $1", [users.manager]);
  }
});

test('US08 records linked delivery transitions, not unchanged status, progress-only or note-only saves', async () => {
  const id = await approved();
  const projectId = (await pool.query('SELECT id FROM projects WHERE opportunity_id = $1', [id])).rows[0].id;
  assert.equal(await createProject(pool, users.manager, { opportunityId: id }), undefined);
  await updateProject(pool, projectId, users.team, { note: 'Started investigating.' });
  await updateProject(pool, projectId, users.team, { progress: 10 });
  for (const status of ['in_progress', 'in_progress', 'testing', 'completed']) {
    await updateProject(pool, projectId, users.team, { status, note: `Saved ${status}` });
  }
  const events = (await history(id)).filter((entry) => entry.event_type.startsWith('delivery_'));
  assert.deepEqual(events.map(({ from_status, to_status }) => [from_status, to_status]), [
    [null, 'not_started'], ['not_started', 'in_progress'], ['in_progress', 'testing'], ['testing', 'completed']
  ]);
  assert.equal(events[0].actor_id, users.manager);
  assert.ok(events.slice(1).every((entry) => entry.actor_id === users.team && entry.actor_name === 'Demo Engineer'));
  assert.ok(events.every((entry) => entry.reason === null));
  assert.equal((await pool.query('SELECT status FROM opportunities WHERE id = $1', [id])).rows[0].status, 'approved');
  assert.equal((await pool.query('SELECT count(*)::integer AS count FROM project_progress_notes WHERE project_id = $1', [projectId])).rows[0].count, 5);
});

test('US08 failed writes and invalid decisions leave no fabricated history', async () => {
  const id = (await submit()).id;
  assert.equal(await decide(id), undefined);
  assert.equal(await assess(randomUUID()), undefined);
  assert.equal(await updateProject(pool, randomUUID(), users.team, { status: 'testing' }), false);
  assert.equal((await history(id)).length, 1);
  await assess(id);
  await assert.rejects(decide(id, 'rejected', ' '), (error) => error.code === '23514');
  assert.equal((await history(id)).length, 2);
  assert.equal((await pool.query('SELECT status FROM opportunities WHERE id = $1', [id])).rows[0].status, 'in_assessment');
});

test('US08 concurrent assessment and decision requests add each actual transition only once', async () => {
  const id = (await submit()).id;
  await Promise.all([assess(id), assess(id)]);
  assert.equal((await history(id)).filter((entry) => entry.event_type === 'status_changed').length, 1);
  const results = await Promise.all([decide(id, 'approved', 'Proceed.'), decide(id, 'rejected', 'Do not proceed.')]);
  assert.equal(results.filter(Boolean).length, 1);
  const events = (await history(id)).filter((entry) => entry.event_type === 'decision_recorded');
  assert.equal(events.length, 1);
  assert.equal(events[0].to_status, results.find(Boolean).status);
});

test('US08 a history insertion failure rolls back each write and its related data', async () => {
  const scenarios = [
    async () => ({ write: submit, check: async () => {
      assert.equal((await pool.query('SELECT count(*)::integer AS count FROM opportunities')).rows[0].count, 0);
    } }),
    async () => {
      const id = (await submit()).id;
      return { write: () => assess(id), check: async () => {
        assert.equal((await pool.query('SELECT status FROM opportunities WHERE id = $1', [id])).rows[0].status, 'submitted');
        assert.equal((await pool.query('SELECT count(*)::integer AS count FROM opportunity_assessments')).rows[0].count, 0);
      } };
    },
    async () => {
      const id = await reviewed();
      return { write: () => decide(id), check: async () => {
        assert.equal((await pool.query('SELECT status FROM opportunities WHERE id = $1', [id])).rows[0].status, 'in_assessment');
        assert.equal((await pool.query('SELECT count(*)::integer AS count FROM opportunity_decisions')).rows[0].count, 0);
      } };
    },
    async () => {
      const id = await approved();
      await pool.query('DELETE FROM projects WHERE opportunity_id = $1', [id]);
      return { write: () => createProject(pool, users.manager, { opportunityId: id }), check: async () => {
        assert.equal((await pool.query('SELECT count(*)::integer AS count FROM projects')).rows[0].count, 0);
      } };
    },
    async () => {
      const id = await approved();
      const projectId = (await pool.query('SELECT id FROM projects WHERE opportunity_id = $1', [id])).rows[0].id;
      return { write: () => updateProject(pool, projectId, users.team, { status: 'testing', note: 'Must roll back.' }), check: async () => {
        assert.equal((await pool.query('SELECT status FROM projects WHERE id = $1', [projectId])).rows[0].status, 'not_started');
        assert.equal((await pool.query('SELECT count(*)::integer AS count FROM project_progress_notes')).rows[0].count, 0);
      } };
    }
  ];
  for (const setup of scenarios) {
    await pool.query('TRUNCATE opportunities CASCADE');
    const scenario = await setup();
    const before = (await pool.query('SELECT count(*)::integer AS count FROM opportunity_history')).rows[0].count;
    await pool.query("ALTER TABLE opportunity_history ADD CONSTRAINT simulate_history_failure CHECK (source <> 'live') NOT VALID");
    try {
      await assert.rejects(scenario.write(), (error) => error.code === '23514');
      await scenario.check();
      assert.equal((await pool.query('SELECT count(*)::integer AS count FROM opportunity_history')).rows[0].count, before);
    } finally {
      await pool.query('ALTER TABLE opportunity_history DROP CONSTRAINT simulate_history_failure');
    }
  }
});
