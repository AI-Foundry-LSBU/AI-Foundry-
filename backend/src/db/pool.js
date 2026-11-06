import pg from 'pg';

export function createPool(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error('Set DATABASE_URL in backend/.env before running the backend.');
  }

  const pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 5000 });
  pool.on('error', (error) => {
    console.error('Idle PostgreSQL connection failed:', error.code ?? error.name);
  });
  return pool;
}
