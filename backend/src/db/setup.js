import { readFile, readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createPool } from './pool.js';
import { demoAccounts, hashPassword, verifyPassword } from '../auth/passwords.js';

const migrationsDirectory = new URL('../../db/migrations/', import.meta.url);
const seedFile = new URL('../../db/seeds/demo_users.sql', import.meta.url);

export async function migrate(pool) {
  const files = (await readdir(migrationsDirectory))
    .filter((name) => /^\d+_[a-z_]+\.sql$/.test(name))
    .sort();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    // Serialize migration runs so a second process cannot apply the same file.
    await client.query('SELECT pg_advisory_xact_lock(308241973)');
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const { rows } = await client.query('SELECT filename FROM schema_migrations');
    const applied = new Set(rows.map(({ filename }) => filename));
    for (const filename of files) {
      if (applied.has(filename)) continue;
      await client.query(await readFile(new URL(filename, migrationsDirectory), 'utf8'));
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function seed(pool, environment = process.env) {
  for (const [, key] of demoAccounts) {
    const value = environment[key];
    if (typeof value !== 'string' || value.length < 12 || value.length > 128) {
      throw new Error(`Set ${key} to 12–128 characters. Run npm run auth:configure first.`);
    }
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(308241974)');
    await client.query(await readFile(seedFile, 'utf8'));
    for (const [email, key] of demoAccounts) {
      const { rows: [user] } = await client.query('SELECT password_hash FROM users WHERE email = $1', [email]);
      if (user.password_hash && await verifyPassword(user.password_hash, environment[key])) continue;
      await client.query(
        'UPDATE users SET password_hash = $2, auth_version = auth_version + 1 WHERE email = $1',
        [email, await hashPassword(environment[key])]
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let pool;
  try {
    pool = createPool();
    switch (process.argv[2]) {
      case 'migrate':
        await migrate(pool);
        console.log('Database migrations are up to date.');
        break;
      case 'seed':
        await seed(pool);
        console.log('Demo users are ready.');
        break;
      default:
        throw new Error('Choose migrate or seed.');
    }
  } catch (error) {
    console.error('Database setup failed:', error.code ?? error.message);
    process.exitCode = 1;
  } finally {
    await pool?.end();
  }
}
