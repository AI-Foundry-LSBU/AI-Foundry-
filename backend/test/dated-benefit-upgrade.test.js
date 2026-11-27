import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import pg from 'pg';
import { migrate, seed } from '../src/db/setup.js';
import { testPasswords } from '../test-support/client.js';

test('US11 upgrade preserves old values and backfills completion only from a real history event', async t => {
  assert.ok(process.env.TEST_DATABASE_URL);
  const schema = `dated_upgrade_${randomUUID().replaceAll('-', '')}`;
  const admin = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL,
    onConnect: client => client.query(`SET search_path TO ${schema}`) });
  t.after(async () => {
    await pool.end();
    try { await admin.query(`DROP SCHEMA ${schema} CASCADE`); }
    finally { await admin.end(); }
  });
  const directory = new URL('../db/migrations/', import.meta.url);
  await pool.query('CREATE TABLE schema_migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP)');
  for (const file of (await readdir(directory)).filter(name => /^\d+_[a-z_]+\.sql$/.test(name) && Number(name.split('_')[0]) < 18).sort()) {
    await pool.query(await readFile(new URL(file, directory), 'utf8'));
    await pool.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
  }
  await seed(pool, testPasswords);
  const owner = (await pool.query("SELECT id FROM users WHERE email='manager@lsbu.ac.uk'")).rows[0].id;
  const projects = [];
  for (const title of ['Known completion', 'Undated completion']) {
    const opportunity = (await pool.query(`INSERT INTO opportunities
      (submitted_by,title,department,problem_description,proposed_improvement,status)
      VALUES ($1,$2,'Estates','Test problem','Test improvement','approved') RETURNING id`, [owner, title])).rows[0].id;
    const id = (await pool.query(`INSERT INTO projects (opportunity_id,created_by,status,progress,updated_at)
      VALUES ($1,$2,'completed',100,'2026-11-01T12:00:00Z') RETURNING id`, [opportunity, owner])).rows[0].id;
    projects.push(id);
    if (title === 'Known completion') await pool.query(`INSERT INTO opportunity_history
      (opportunity_id,event_type,from_status,to_status,actor_id,actor_name,occurred_at)
      VALUES ($1,'delivery_status_changed','testing','completed',$2,'Demo Manager','2025-04-15T09:00:00Z')`, [opportunity, owner]);
    else await pool.query(`INSERT INTO opportunity_history
      (opportunity_id,event_type,from_status,to_status,actor_id,actor_name,occurred_at,source)
      VALUES ($1,'delivery_status_changed','testing','completed',$2,'Demo Manager','2026-11-01T12:00:00Z','backfill')`, [opportunity, owner]);
  }
  await pool.query(`INSERT INTO project_benefits
    (project_id,category,description,measurement,estimated,actual,unit,recorded_on,created_by,updated_by)
    VALUES ($1,'efficiency','Preserved legacy value','Hours',12.5,0,'Hours/month','2026-01-31',$2,$2)`, [projects[0], owner]);
  await migrate(pool);
  const dated = (await pool.query('SELECT completed_at,updated_at FROM projects WHERE id=$1', [projects[0]])).rows[0];
  const undated = (await pool.query('SELECT completed_at FROM projects WHERE id=$1', [projects[1]])).rows[0];
  assert.equal(dated.completed_at.toISOString(), '2025-04-15T09:00:00.000Z');
  assert.equal(dated.updated_at.toISOString(), '2026-11-01T12:00:00.000Z');
  assert.equal(undated.completed_at, null);
  const benefit = (await pool.query('SELECT estimated,actual,recurrence,recurs_until FROM project_benefits')).rows[0];
  assert.deepEqual(benefit, { estimated: '12.5000', actual: '0.0000', recurrence: 'unspecified', recurs_until: null });
  await pool.query('UPDATE projects SET updated_at=clock_timestamp() WHERE id=$1', [projects[1]]);
  assert.equal((await pool.query('SELECT completed_at FROM projects WHERE id=$1', [projects[1]])).rows[0].completed_at, null);
  await migrate(pool);
  assert.equal((await pool.query("SELECT count(*)::integer AS n FROM schema_migrations WHERE filename='018_dated_benefit_reporting.sql'")).rows[0].n, 1);
});
