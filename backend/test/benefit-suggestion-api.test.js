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
const schema = `benefit_suggestion_${randomUUID().replaceAll('-', '')}`;
const draft = {
  category: 'efficiency',
  description: 'Staff would spend less time confirming bookings.',
  measurement: 'Hours saved confirming bookings',
  unit: 'Hours/month',
  estimated: 4
};
let admin;
let pool;
let schemaCreated = false;
let seen;

before(async () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  assert.ok(connectionString, 'Set TEST_DATABASE_URL before running the integration tests.');
  admin = new pg.Pool({ connectionString, connectionTimeoutMillis: 5000 });
  await admin.query(`CREATE SCHEMA ${schema}`);
  schemaCreated = true;
  pool = new pg.Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 5000,
    onConnect: (client) => client.query(`SET search_path TO ${schema}`)
  });
  await migrate(pool);
  await seed(pool, testPasswords);
});

beforeEach(() => {
  seen = undefined;
  return pool.query('TRUNCATE opportunities, opportunity_assessments, opportunity_decisions, projects, project_progress_notes, project_benefits CASCADE');
});

after(async () => {
  try {
    await pool?.end();
    if (schemaCreated) await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  } finally {
    await admin?.end();
  }
});

function app() {
  return createApp(pool, {
    sessionSecret,
    sessionSchema: schema,
    pruneSessionInterval: false,
    suggestBenefit: async (opportunity) => {
      seen = opportunity;
      return draft;
    }
  });
}

async function start(t) {
  const server = app().listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return server;
}

test('a manager receives a draft benefit and nothing is recorded', async (t) => {
  const server = await start(t);
  const created = await request(server, '/api/v1/opportunities', {
    email: staff,
    body: {
      title: 'Automate booking emails',
      department: 'Estates & Facilities',
      problemDescription: 'Staff manually confirm every room booking.',
      proposedImprovement: 'Send confirmations when a booking is approved.',
      expectedBenefits: 'Save about four hours a month.'
    }
  });
  const path = `/api/v1/opportunities/${created.body.id}/benefit-suggestion`;
  const suggestion = await request(server, path, { email: manager, method: 'POST' });
  assert.equal(suggestion.status, 200);
  assert.deepEqual(suggestion.body, draft);
  assert.equal(seen.problemDescription, 'Staff manually confirm every room booking.');
  assert.equal(seen.expectedBenefits, 'Save about four hours a month.');
  assert.equal((await request(server, path, { email: staff, method: 'POST' })).status, 403);
  assert.equal((await request(server, `/api/v1/opportunities/${randomUUID()}/benefit-suggestion`, { email: manager, method: 'POST' })).status, 404);
  assert.equal((await pool.query('SELECT count(*)::integer AS count FROM project_benefits')).rows[0].count, 0);
});
