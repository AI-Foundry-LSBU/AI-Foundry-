import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { before, beforeEach, after } from 'node:test';
import pg from 'pg';
import { createApp } from '../src/app.js';
import { migrate, seed } from '../src/db/setup.js';
import { sessionSecret, testPasswords } from './client.js';

export const manager = 'manager@lsbu.ac.uk';
export const benefitInput = (projectId, extra = {}) => ({
  projectId, category: 'efficiency', description: 'A synthetic measured outcome.',
  measurement: 'Saved hours', estimated: 10, actual: 8, unit: 'Hours/month',
  date: '2026-01-31', notes: '', recurrence: 'one_off', recursUntil: null, ...extra
});

export function reportingFixture() {
  const schema = `report_${randomUUID().replaceAll('-', '')}`;
  let admin, pool;
  const servers = new Set();
  before(async () => {
    assert.ok(process.env.TEST_DATABASE_URL, 'Set TEST_DATABASE_URL before integration tests.');
    admin = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
    await admin.query(`CREATE SCHEMA ${schema}`);
    pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL,
      onConnect: client => client.query(`SET search_path TO ${schema}`) });
    await migrate(pool);
    await seed(pool, testPasswords);
  });
  beforeEach(() => pool.query('TRUNCATE opportunities CASCADE'));
  after(async () => {
    for (const server of servers) {
      await new Promise(resolve => server.close(resolve));
      server.app.locals.sessionStore.close();
    }
    await pool?.end();
    try { await admin?.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); }
    finally { await admin?.end(); }
  });
  return {
    get pool() { return pool; },
    async open(options = {}) {
      const app = createApp(pool, { sessionSecret, sessionSchema: schema, pruneSessionInterval: false, ...options });
      const server = app.listen(0, '127.0.0.1');
      server.app = app;
      servers.add(server);
      await once(server, 'listening');
      return server;
    },
    async project(title, { status = 'completed', completedOn = '2026-01-01' } = {}) {
      const { rows: [saved] } = await pool.query(`
        WITH opportunity AS (
          INSERT INTO opportunities (submitted_by, title, department, problem_description, proposed_improvement, status)
          SELECT id, $1, 'Estates', 'Synthetic test problem', 'Synthetic improvement', 'approved'
          FROM users WHERE email = 'staff@lsbu.ac.uk' RETURNING id
        )
        INSERT INTO projects (opportunity_id, created_by, status, progress, completed_at)
        SELECT opportunity.id, u.id, $2, CASE WHEN $2 = 'completed' THEN 100 ELSE 0 END,
          CASE WHEN $2 = 'completed' THEN $3::timestamptz ELSE NULL END
        FROM opportunity CROSS JOIN users u WHERE u.email = $4 RETURNING id`,
      [title, status, `${completedOn}T12:00:00Z`, manager]);
      return saved.id;
    }
  };
}
