import assert from 'node:assert/strict';
import { test } from 'node:test';
import { migrate } from '../src/db/setup.js';
import { authenticatedRequest as request } from '../test-support/client.js';
import { reportingFixture, manager, benefitInput } from '../test-support/reporting-fixture.js';

const fixture = reportingFixture();

test('US11 preserves unknown measurements as null, explicit zero as zero, and old clients as unspecified', async () => {
  const server = await fixture.open();
  const projectId = await fixture.project('Known and unknown values');
  const body = benefitInput(projectId, { estimated: null, actual: 0 });
  delete body.recurrence;
  delete body.recursUntil;
  const created = await request(server, '/api/v1/benefits', { email: manager, body });
  assert.equal(created.status, 201);
  assert.equal(created.body.estimated, null);
  assert.equal(created.body.actual, 0);
  assert.equal(created.body.recurrence, 'unspecified');
  assert.equal(created.body.recursUntil, null);
  const saved = (await fixture.pool.query('SELECT estimated, actual FROM project_benefits WHERE id=$1', [created.body.id])).rows[0];
  assert.equal(saved.estimated, null);
  assert.equal(saved.actual, '0.0000');
  const response = await request(server, '/api/v1/benefits/summary', { email: manager });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.missingValues, [{ id: created.body.id, projectId, unit: 'Hours/month', estimatedMissing: true, actualMissing: false }]);
});

test('US11 schedules are validated and survive old-client edits that omit the new fields', async () => {
  const server = await fixture.open();
  const projectId = await fixture.project('Recurring values');
  const body = benefitInput(projectId, { recurrence: 'monthly', recursUntil: '2026-12-31' });
  const created = await request(server, '/api/v1/benefits', { email: manager, body });
  assert.equal(created.status, 201);
  const edit = { ...body, actual: null, description: 'Edited without changing recurrence.' };
  delete edit.recurrence;
  delete edit.recursUntil;
  const updated = await request(server, `/api/v1/benefits/${created.body.id}`, { email: manager, method: 'PUT', body: edit });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.recurrence, 'monthly');
  assert.equal(updated.body.recursUntil, '2026-12-31');
  assert.equal(updated.body.actual, null);
  for (const change of [
    { recurrence: 'daily' }, { recurrence: null }, { recursUntil: null },
    { recursUntil: '2026-01-30' }, { recursUntil: '2026-02-30' },
    { recurrence: 'one_off', recursUntil: '2026-12-31' },
    { unit: 'GBP/year' }, { recurrence: 'yearly', unit: 'Hours/month' },
    { estimated: undefined }, { actual: '' }
  ]) {
    const result = await request(server, '/api/v1/benefits', { email: manager, body: { ...body, ...change } });
    assert.equal(result.status, 400, JSON.stringify(change));
  }
  const again = await request(server, `/api/v1/benefits/${created.body.id}`, { email: manager });
  assert.equal(again.body.description, updated.body.description);
});

test('US11 completion timestamps are set on the actual transition and remain stable after edits', async () => {
  const server = await fixture.open();
  const id = await fixture.project('Completion date', { status: 'in_progress' });
  const before = Date.now();
  const completed = await request(server, `/api/v1/projects/${id}`, {
    email: 'engineer@lsbu.ac.uk', method: 'PATCH', body: { status: 'completed' }
  });
  assert.equal(completed.status, 200);
  assert.ok(Date.parse(completed.body.completedAt) >= before);
  const edited = await request(server, `/api/v1/projects/${id}`, {
    email: manager, method: 'PATCH', body: { note: 'A note added after completion.' }
  });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.completedAt, completed.body.completedAt);
  await migrate(fixture.pool);
  assert.equal((await request(server, `/api/v1/projects/${id}`, { email: manager })).body.completedAt, completed.body.completedAt);
});

test('US11 database constraints reject invalid recurrence even outside the API', async () => {
  const id = await fixture.project('Database schedule rules');
  const userId = (await fixture.pool.query('SELECT id FROM users WHERE email=$1', [manager])).rows[0].id;
  const insert = (recurrence, until, unit) => fixture.pool.query(`INSERT INTO project_benefits
    (project_id,category,description,measurement,estimated,actual,unit,recorded_on,created_by,updated_by,recurrence,recurs_until)
    VALUES ($1,'efficiency','Synthetic','Hours',NULL,NULL,$2,'2026-01-31',$3,$3,$4,$5)`, [id, unit, userId, recurrence, until]);
  await assert.rejects(() => insert('monthly', null, 'Hours/month'), { code: '23514' });
  await assert.rejects(() => insert('monthly', '2026-01-01', 'Hours/month'), { code: '23514' });
  await assert.rejects(() => insert('yearly', '2027-01-31', 'Hours/month'), { code: '23514' });
  await insert('monthly', '2026-12-31', 'Hours/month');
});
