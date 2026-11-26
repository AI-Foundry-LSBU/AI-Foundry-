import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { after, before, beforeEach } from 'node:test';
import pg from 'pg';
import { createApp } from '../src/app.js';
import { migrate, seed } from '../src/db/setup.js';
import { sessionSecret, testPasswords } from './client.js';

export const staff = 'staff@lsbu.ac.uk';
export const manager = 'manager@lsbu.ac.uk';
export const engineer = 'engineer@lsbu.ac.uk';
export const solutionInput = {
  name: 'Verified room booking', description: 'Reserve a meeting room and receive a confirmation email.',
  keywords: ['room', 'booking'], href: 'https://example.com/rooms', accessInstructions: 'Use your staff account.',
  visibility: 'all_users', active: true, verified: true,
  verificationNotes: 'Checked the service owner documentation and tested access.'
};

export function solutionFixture() {
  const schema = `solutions_${randomUUID().replaceAll('-', '')}`;
  let admin;
  let pool;
  let created = false;
  const servers = new Set();
  before(async () => {
    assert.ok(process.env.TEST_DATABASE_URL, 'Set TEST_DATABASE_URL before running integration tests.');
    admin = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
    await admin.query(`CREATE SCHEMA ${schema}`);
    created = true;
    pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL,
      onConnect: (client) => client.query(`SET search_path TO ${schema}`) });
    assert.equal((await pool.query('SELECT current_schema() AS name')).rows[0].name, schema);
    await migrate(pool);
    await seed(pool, testPasswords);
  });
  beforeEach(() => pool.query('DELETE FROM solution_catalogue WHERE created_by IS NOT NULL'));
  after(async () => {
    for (const server of servers) {
      await new Promise((resolve) => server.close(resolve));
      server.app.locals.sessionStore.close();
    }
    try {
      await pool?.end();
      if (created) await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    } finally { await admin?.end(); }
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
    }
  };
}
