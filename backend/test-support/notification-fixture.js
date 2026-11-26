import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import pg from 'pg';
import { createApp } from '../src/app.js';
import { migrate, seed } from '../src/db/setup.js';
import { insertOpportunity, saveAssessment, saveDecision } from '../src/opportunities/queries.js';
import { sessionSecret, testPasswords } from './client.js';

export const assessment = {
  strategicAlignment: 5, benefitPotential: 4, complexity: 3,
  resourceRequirements: 2, speedToValue: 5, priority: 'high'
};
export const submission = {
  title: 'Automate booking emails', department: 'Estates', problemDescription: 'Manual emails',
  proposedImprovement: 'Automate confirmations', source: 'staff_submission'
};

export async function notificationFixture() {
  const connectionString = process.env.TEST_DATABASE_URL;
  assert.ok(connectionString, 'Set TEST_DATABASE_URL before running integration tests.');
  const schema = `notification_test_${randomUUID().replaceAll('-', '')}`;
  const admin = new pg.Pool({ connectionString, connectionTimeoutMillis: 5000 });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool = new pg.Pool({ connectionString, max: 4, connectionTimeoutMillis: 5000,
    onConnect: (client) => client.query(`SET search_path TO ${schema}`) });
  const close = async () => {
    try {
      await pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    } finally { await admin.end(); }
  };
  try {
    assert.equal((await pool.query('SELECT current_schema() AS name')).rows[0].name, schema);
    await migrate(pool);
    await seed(pool, testPasswords);
    const accounts = (await pool.query('SELECT id, email FROM users')).rows;
    const users = Object.fromEntries([
      ['staff', 'staff@lsbu.ac.uk'], ['otherStaff', 'staff2@lsbu.ac.uk'],
      ['manager', 'manager@lsbu.ac.uk'], ['team', 'engineer@lsbu.ac.uk']
    ].map(([key, email]) => [key, accounts.find((user) => user.email === email).id]));
    const submit = (userId = users.staff) => insertOpportunity(pool, userId, {
      ...submission, source: userId === users.team ? 'hackathon' : 'staff_submission'
    });
    const review = (id) => saveAssessment(pool, id, users.manager, assessment);
    const decide = (id, decision = 'approved') => saveDecision(pool, id, users.manager, { decision, reason: 'Reviewed by the manager.' });
    const notices = async (id) => (await pool.query(
      'SELECT * FROM notifications WHERE opportunity_id = $1 ORDER BY created_at, id', [id]
    )).rows;
    const project = async (id) => (await pool.query('SELECT * FROM projects WHERE opportunity_id = $1', [id])).rows[0];
    const ready = async (userId = users.staff) => {
      const opportunity = await submit(userId);
      await review(opportunity.id);
      await decide(opportunity.id);
      return { opportunity, project: await project(opportunity.id) };
    };
    const start = async (t, options = {}) => {
      const app = createApp(pool, { sessionSecret, sessionSchema: schema, pruneSessionInterval: false, ...options });
      const server = app.listen(0, '127.0.0.1');
      await once(server, 'listening');
      t.after(async () => {
        await new Promise((resolve) => server.close(resolve));
        app.locals.sessionStore.close();
      });
      return server;
    };
    return { pool, users, close, submit, review, decide, notices, project, ready, start };
  } catch (error) {
    await close();
    throw error;
  }
}
