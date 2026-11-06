import { createApp } from './app.js';
import { createPool } from './db/pool.js';

let pool;

try {
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer from 1 to 65535.');
  }

  pool = createPool();
  await pool.query('SELECT 1');
  const server = createApp(pool).listen(port, '127.0.0.1', () => {
    console.log(`AI Foundry API listening at http://127.0.0.1:${port}/api/v1`);
  });

  server.on('error', async (error) => {
    console.error('HTTP server failed:', error.code ?? error.name);
    process.exitCode = 1;
    await pool.end();
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => server.close(() => pool.end()));
  }
} catch (error) {
  console.error('Backend startup failed:', error.code ?? error.message);
  process.exitCode = 1;
  await pool?.end();
}
