import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import pg from 'pg';
import { migrate, seed } from '../src/db/setup.js';
import { testPasswords } from '../test-support/client.js';

const schema = `history_schema_${randomUUID().replaceAll('-', '')}`;
const submittedId = randomUUID();
const rejectedId = randomUUID();
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
  await pool.query('CREATE TABLE schema_migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP)');
  for (const file of ['001_initial.sql', '002_opportunity_assessments.sql', '003_opportunity_decisions.sql', '004_project_delivery.sql', '005_project_benefits.sql', '006_authentication.sql']) {
    await pool.query(await readFile(new URL(`../db/migrations/${file}`, import.meta.url), 'utf8'));
    await pool.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
  }
  await seed(pool, testPasswords);
  for (const [id, status] of [[submittedId, 'submitted'], [rejectedId, 'rejected']]) {
    await pool.query(`INSERT INTO opportunities (
      id, submitted_by, title, department, problem_description, proposed_improvement, status, submitted_at
    ) SELECT $1, id, 'Saved before US08', 'Estates', 'Issue', 'Improvement', $2, '2026-11-01T10:00:00Z'
      FROM users WHERE email = 'staff@lsbu.ac.uk'`, [id, status]);
  }
  await pool.query(`INSERT INTO opportunity_decisions (opportunity_id, decided_by, decision, reason, decided_at)
    SELECT $1, id, 'rejected', 'Already covered by another project.', '2026-11-02T11:00:00Z'
    FROM users WHERE email = 'manager@lsbu.ac.uk'`, [rejectedId]);
  await migrate(pool);
});

after(async () => {
  try {
    await pool?.end();
    if (created) await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  } finally { await admin?.end(); }
});

test('US08 migration recovers known submissions and decisions with their original actors and dates', async () => {
  const { rows } = await pool.query(`SELECT h.*, u.role FROM opportunity_history h
    JOIN users u ON u.id = h.actor_id ORDER BY h.occurred_at, h.id`);
  assert.equal(rows.length, 3);
  assert.ok(rows.every((row) => row.source === 'backfill'));
  assert.equal(rows.filter((row) => row.event_type === 'submitted').length, 2);
  const decision = rows.find((row) => row.event_type === 'decision_recorded');
  assert.equal(decision.actor_name, 'Demo Manager');
  assert.equal(decision.role, 'manager');
  assert.equal(decision.reason, 'Already covered by another project.');
  assert.equal(decision.occurred_at.toISOString(), '2026-11-02T11:00:00.000Z');
  assert.equal(decision.from_status, null); // Do not invent an old status.
  assert.equal((await pool.query('SELECT status FROM opportunities WHERE id = $1', [rejectedId])).rows[0].status, 'rejected');
});

test('US08 migration is repeatable without duplicating recovered history', async () => {
  await migrate(pool);
  assert.equal((await pool.query('SELECT count(*)::integer AS count FROM opportunity_history')).rows[0].count, 3);
});

test('US08 database rejects edits and direct deletion of previous entries', async () => {
  for (const sql of [
    "UPDATE opportunity_history SET reason = 'Changed' WHERE event_type = 'decision_recorded'",
    "DELETE FROM opportunity_history WHERE event_type = 'decision_recorded'"
  ]) {
    await assert.rejects(pool.query(sql), (error) => error.code === '55000');
  }
  assert.equal((await pool.query("SELECT reason FROM opportunity_history WHERE event_type = 'decision_recorded'")).rows[0].reason,
    'Already covered by another project.');
});

test('US08 rejects invalid transitions and missing rejection reasons', async () => {
  for (const [event, from, to, reason] of [
    ['status_changed', 'submitted', 'submitted', null],
    ['status_changed', 'submitted', 'testing', null],
    ['decision_recorded', 'in_assessment', 'rejected', ' ']
  ]) {
    await assert.rejects(pool.query(`INSERT INTO opportunity_history
      (opportunity_id, event_type, from_status, to_status, actor_id, actor_name, reason)
      SELECT $1, $2, $3, $4, id, name, $5 FROM users WHERE email = 'manager@lsbu.ac.uk'`,
    [rejectedId, event, from, to, reason]), (error) => error.code === '23514');
  }
});

test('US08 history follows the existing opportunity deletion policy', async () => {
  await pool.query('DELETE FROM opportunities WHERE id = $1', [submittedId]);
  assert.equal((await pool.query('SELECT count(*)::integer AS count FROM opportunity_history WHERE opportunity_id = $1', [submittedId])).rows[0].count, 0);
  assert.equal((await pool.query('SELECT count(*)::integer AS count FROM opportunity_history WHERE opportunity_id = $1', [rejectedId])).rows[0].count, 2);
});

test('adding notification migrations preserves a database that already applied US08 history', async () => {
  const legacySchema = `history_upgrade_${randomUUID().replaceAll('-', '')}`;
  await admin.query(`CREATE SCHEMA ${legacySchema}`);
  const legacy = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 1,
    onConnect: (client) => client.query(`SET search_path TO ${legacySchema}`) });
  try {
    await legacy.query('CREATE TABLE schema_migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP)');
    for (const file of ['001_initial.sql', '002_opportunity_assessments.sql', '003_opportunity_decisions.sql', '004_project_delivery.sql', '005_project_benefits.sql', '006_authentication.sql']) {
      await legacy.query(await readFile(new URL(`../db/migrations/${file}`, import.meta.url), 'utf8'));
      await legacy.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
    }
    await seed(legacy, testPasswords);
    await legacy.query(`INSERT INTO opportunities
      (submitted_by, title, department, problem_description, proposed_improvement)
      SELECT id, 'Keep this saved history', 'Estates', 'Issue', 'Improvement'
      FROM users WHERE email = 'staff@lsbu.ac.uk'`);
    await legacy.query(await readFile(new URL('../db/migrations/007_opportunity_history.sql', import.meta.url), 'utf8'));
    await legacy.query("INSERT INTO schema_migrations (filename) VALUES ('007_opportunity_history.sql')");
    const before = (await legacy.query('SELECT * FROM opportunity_history ORDER BY id')).rows;
    assert.equal(before.length, 1);
    await migrate(legacy);
    await migrate(legacy);
    assert.deepEqual((await legacy.query('SELECT * FROM opportunity_history ORDER BY id')).rows, before);
    const files = (await legacy.query("SELECT filename FROM schema_migrations WHERE filename LIKE '007%' OR filename LIKE '008%' ORDER BY filename")).rows;
    assert.deepEqual(files.map((row) => row.filename), [
      '007_notifications.sql', '007_opportunity_history.sql', '008_notification_statuses.sql'
    ]);
    await legacy.query(`INSERT INTO notifications (user_id, opportunity_id, kind, message)
      SELECT submitted_by, id, 'under_review', 'Review started.' FROM opportunities`);
    assert.equal((await legacy.query('SELECT count(*)::integer AS count FROM notifications')).rows[0].count, 1);
  } finally {
    await legacy.end();
    await admin.query(`DROP SCHEMA ${legacySchema} CASCADE`);
  }
});
