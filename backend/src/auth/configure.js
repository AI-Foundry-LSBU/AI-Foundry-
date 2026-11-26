import { readFile, writeFile, chmod } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { parseEnv } from 'node:util';
import { demoAccounts } from './passwords.js';

try {
  const path = new URL('../../.env', import.meta.url);
  let text = await readFile(path, 'utf8');
  const values = parseEnv(text);
  for (const key of ['SESSION_SECRET', ...demoAccounts.map(([, key]) => key)]) {
    if (values[key]?.trim()) continue;
    const value = randomBytes(key === 'SESSION_SECRET' ? 32 : 18).toString('base64url');
    const line = new RegExp(`^${key}=.*$`, 'm');
    text = line.test(text) ? text.replace(line, `${key}=${value}`) : `${text.trimEnd()}\n${key}=${value}\n`;
  }
  await writeFile(path, text, { mode: 0o600 });
  await chmod(path, 0o600);
  console.log('Authentication settings are ready in backend/.env. Open that file locally to find the four demo passwords.');
  console.log('Existing database settings and existing passwords have been kept. Next run npm run db:migrate and npm run db:seed.');
} catch (error) {
  console.error(error.code === 'ENOENT' ? 'First copy backend/.env.example to backend/.env.' : 'Could not update backend/.env. Check file permissions.');
  process.exitCode = 1;
}
