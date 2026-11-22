import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import pg from 'pg';
import { migrate, seed } from '../src/db/setup.js';
import { testPasswords } from '../test-support/client.js';

const schema = `notification_schema_${randomUUID().replaceAll('-', '')}`;
let admin;
let pool;
let created = false;
let opportunityId;
let original;
const savedColumns = 'id, user_id, opportunity_id, kind, message, created_at, read_at';

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
  const directory = new URL('../db/migrations/', import.meta.url);
  const oldFiles = (await readdir(directory)).filter((name) => /^\d+_[a-z_]+\.sql$/.test(name) && Number(name.split('_')[0]) < 15).sort();
  for (const file of oldFiles) {
    await pool.query(await readFile(new URL(file, directory), 'utf8'));
    await pool.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
  }
  await seed(pool, testPasswords);
  opportunityId = (await pool.query(`INSERT INTO opportunities
    (submitted_by, title, department, problem_description, proposed_improvement)
    SELECT id, 'Existing notification request', 'Estates', 'Issue', 'Improvement'
    FROM users WHERE email = 'staff@lsbu.ac.uk' RETURNING id`)).rows[0].id;
  for (const read of [false, true]) {
    await pool.query(`INSERT INTO notifications
      (user_id, opportunity_id, kind, message, created_at, read_at)
      SELECT submitted_by, id, 'under_review', 'Saved before US09.', '2026-11-20T10:00:00Z',
             CASE WHEN $2 THEN '2026-11-21T10:00:00Z'::timestamptz ELSE NULL END
      FROM opportunities WHERE id = $1`, [opportunityId, read]);
  }
  original = (await pool.query(`SELECT ${savedColumns} FROM notifications ORDER BY id`)).rows;
  await migrate(pool);
});
after(async () => {
  try {
    await pool?.end();
    if (created) await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  } finally { await admin?.end(); }
});

test('US09 upgrade preserves existing messages, recipients, timestamps and read states', async () => {
  assert.deepEqual((await pool.query(`SELECT ${savedColumns} FROM notifications ORDER BY id`)).rows, original);
  assert.ok((await pool.query('SELECT history_event_id FROM notifications')).rows.every((row) => row.history_event_id === null));
});

test('US09 repeat migration does not duplicate or reset old notifications', async () => {
  await migrate(pool);
  assert.deepEqual((await pool.query(`SELECT ${savedColumns} FROM notifications ORDER BY id`)).rows, original);
});

test('US09 allows one notification per history event and rejects an invalid event link', async () => {
  const event = (await pool.query(`INSERT INTO opportunity_history
    (opportunity_id, event_type, from_status, to_status, actor_id, actor_name, source)
    SELECT $1, 'status_changed', 'submitted', 'in_assessment', id, name, 'backfill'
    FROM users WHERE email = 'manager@lsbu.ac.uk' RETURNING id`, [opportunityId])).rows[0].id;
  const insert = (eventId) => pool.query(`INSERT INTO notifications
    (user_id, opportunity_id, kind, message, history_event_id)
    SELECT submitted_by, id, 'under_review', 'One saved event.', $2 FROM opportunities WHERE id = $1`,
  [opportunityId, eventId]);
  await insert(event);
  await assert.rejects(insert(event), (error) => error.code === '23505');
  await assert.rejects(insert('9223372036854775807'), (error) => error.code === '23503');
});

test('US09 deleting an eligible opportunity removes its associated notifications', async () => {
  await pool.query('DELETE FROM opportunities WHERE id = $1', [opportunityId]);
  assert.equal((await pool.query('SELECT count(*)::integer AS count FROM notifications')).rows[0].count, 0);
});
