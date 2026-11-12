import argon2 from 'argon2';
import { randomBytes } from 'node:crypto';

export const demoAccounts = [
  ['staff@lsbu.ac.uk', 'DEMO_STAFF_PASSWORD'],
  ['staff2@lsbu.ac.uk', 'DEMO_STAFF2_PASSWORD'],
  ['manager@lsbu.ac.uk', 'DEMO_MANAGER_PASSWORD'],
  ['engineer@lsbu.ac.uk', 'DEMO_ENGINEER_PASSWORD']
];

export function hashPassword(password) {
  return argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
}

let dummyHash;
export async function verifyPassword(hash, password) {
  // Unknown accounts still perform a password verification; the error never reveals account existence.
  const target = hash ?? await (dummyHash ??= hashPassword(randomBytes(32).toString('hex')));
  const matches = await argon2.verify(target, password);
  return Boolean(hash) && matches;
}
