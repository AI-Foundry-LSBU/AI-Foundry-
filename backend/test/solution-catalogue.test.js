import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { migrate } from '../src/db/setup.js';
import { authenticatedRequest as request, login, rawRequest } from '../test-support/client.js';
import { engineer, manager, solutionFixture, solutionInput, staff } from '../test-support/solution-fixture.js';

const fixture = solutionFixture();
const path = '/api/v1/solutions/catalogue';
const create = (server, body = solutionInput) => request(server, path, { email: manager, body });

test('US10 imports prototype solutions as drafts and repeat migrations preserve edits without duplicate seeds', async () => {
  const server = await fixture.open();
  const before = await request(server, path, { email: manager });
  assert.equal(before.body.total, 6);
  assert.ok(before.body.items.every((entry) => !entry.verified && !entry.verifiedAt && !entry.verifiedBy));
  assert.deepEqual((await request(server, '/api/v1/solutions', { email: staff })).body.items, []);
  const saved = await create(server);
  await migrate(fixture.pool);
  await migrate(fixture.pool);
  const after = await request(server, path, { email: manager });
  assert.equal(after.body.total, 7);
  assert.ok(after.body.items.some((entry) => entry.id === saved.body.id && entry.verified));
});

test('US10 only managers manage entries; writes need a session and CSRF token', async () => {
  const server = await fixture.open();
  const created = await create(server);
  for (const email of [undefined, staff, engineer]) {
    assert.equal((await request(server, path, { email })).status, email ? 403 : 401);
    assert.equal((await request(server, path, { email, body: solutionInput })).status, email ? 403 : 401);
    assert.equal((await request(server, `${path}/${created.body.id}`, { email, method: 'PUT', body: solutionInput })).status, email ? 403 : 401);
  }
  const session = await login(server, manager);
  assert.equal((await rawRequest(server, path, { cookie: session.cookie, body: solutionInput })).status, 403);
  assert.equal((await rawRequest(server, '/api/v1/solutions', { headers: { 'X-User-Email': manager } })).status, 401);
});

test('US10 published search excludes drafts, archived entries, restricted records and verification notes', async () => {
  const server = await fixture.open();
  const visible = await create(server);
  await create(server, { ...solutionInput, name: 'Secret payroll', description: 'Restricted salary workflow', visibility: 'manager_only' });
  await create(server, { ...solutionInput, name: 'Draft room', verified: false });
  await create(server, { ...solutionInput, name: 'Retired room', active: false });
  for (const email of [staff, engineer]) {
    const list = await request(server, '/api/v1/solutions?q=room', { email });
    assert.equal(list.status, 200);
    assert.deepEqual(list.body.items.map((entry) => entry.id), [visible.body.id]);
    assert.equal(list.body.total, 1);
    assert.equal(JSON.stringify(list.body).includes('verificationNotes'), false);
    assert.equal(JSON.stringify(list.body).includes('Secret payroll'), false);
    assert.equal((await request(server, '/api/v1/solutions?q=salary', { email })).body.total, 0);
  }
  assert.equal((await request(server, '/api/v1/solutions?q=salary', { email: manager })).body.total, 1);
  assert.equal((await request(server, `${path}?state=draft`, { email: manager })).body.total, 7);
  assert.equal((await request(server, `${path}?state=archived`, { email: manager })).body.total, 1);
});

test('US10 manager updates persist, stamp the verifier and immediately withdraw unpublished entries', async () => {
  const server = await fixture.open();
  const saved = await create(server);
  assert.equal(saved.status, 201);
  const owner = (await fixture.pool.query("SELECT id FROM users WHERE email = 'manager@lsbu.ac.uk'")).rows[0].id;
  assert.equal(saved.body.verifiedBy, owner);
  assert.ok(Number.isFinite(Date.parse(saved.body.verifiedAt)));
  const edit = { ...solutionInput, name: 'Renamed booking', href: null, accessInstructions: 'Ask the verified service desk.' };
  assert.equal((await request(server, `${path}/${saved.body.id}`, { email: manager, method: 'PUT', body: edit })).status, 200);
  const fresh = (await request(server, '/api/v1/solutions?q=renamed', { email: staff })).body.items[0];
  assert.equal(fresh.name, edit.name);
  assert.equal(fresh.href, null);
  assert.equal(fresh.accessInstructions, edit.accessInstructions);
  await request(server, `${path}/${saved.body.id}`, { email: manager, method: 'PUT', body: { ...edit, verified: false } });
  assert.equal((await request(server, '/api/v1/solutions', { email: staff })).body.total, 0);
  const withdrawn = (await request(server, path, { email: manager })).body.items.find((entry) => entry.id === saved.body.id);
  assert.equal(withdrawn.verifiedBy, null);
  assert.equal(withdrawn.verifiedAt, null);
});

test('US10 rejects invalid catalogue bodies and search parameters without altering saved data', async () => {
  const server = await fixture.open();
  const saved = await create(server);
  const invalid = [null, [], {}, { ...solutionInput, name: '' }, { ...solutionInput, description: 'x\0y' },
    { ...solutionInput, href: 'javascript:alert(1)' }, { ...solutionInput, href: 'https://user:pass@example.com' },
    { ...solutionInput, href: null, accessInstructions: null }, { ...solutionInput, verificationNotes: null },
    { ...solutionInput, verifiedBy: randomUUID() }, { ...solutionInput, visibility: 'public' },
    { ...solutionInput, active: 'true' }, { ...solutionInput, keywords: [null] },
    { ...solutionInput, keywords: Array(21).fill('room') }];
  for (const body of invalid) assert.equal((await create(server, body)).status, 400);
  assert.equal((await request(server, `${path}/${saved.body.id}`, { email: manager, method: 'PUT', body: { ...solutionInput, verified: 'yes' } })).status, 400);
  for (const query of ['limit=0', 'limit=51', 'limit=1.5', 'q=a&q=b', 'q=' + 'a'.repeat(201), 'visibility=manager_only']) {
    assert.equal((await request(server, `/api/v1/solutions?${query}`, { email: staff })).status, 400);
  }
  assert.equal((await request(server, `${path}?state=unknown`, { email: manager })).status, 400);
  for (const id of ['bad-id', randomUUID()]) {
    assert.equal((await request(server, `${path}/${id}`, { email: manager, method: 'PUT', body: solutionInput })).status, 404);
  }
  assert.equal((await request(server, '/api/v1/solutions', { email: staff })).body.total, 1);
});
