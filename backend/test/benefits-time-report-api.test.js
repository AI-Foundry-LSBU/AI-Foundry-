import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { login, rawRequest, authenticatedRequest as request } from '../test-support/client.js';
import { reportingFixture, manager, benefitInput } from '../test-support/reporting-fixture.js';

const fixture = reportingFixture();
const path = '/api/v1/benefits/report';
const window = '?from=2026-01-01&to=2026-03-31&period=month';
const total = (report, unit = 'Hours') => report.totals.find(item => item.unit === unit);
async function save(server, body) {
  const response = await request(server, '/api/v1/benefits', { email: manager, body });
  assert.equal(response.status, 201);
  return response.body;
}

test('US11 report is manager-only, session-authenticated, read-only and uncached', async () => {
  const server = await fixture.open({ reportToday: () => '2026-06-15' });
  assert.equal((await request(server, path)).status, 401);
  assert.equal((await request(server, path, { headers: { 'X-User-Email': manager } })).status, 401);
  for (const email of ['staff@lsbu.ac.uk', 'staff2@lsbu.ac.uk', 'engineer@lsbu.ac.uk']) {
    assert.equal((await request(server, path + window, { email })).status, 403);
  }
  const session = await login(server, manager);
  const result = await rawRequest(server, path, { cookie: session.cookie }); // No CSRF token needed for GET.
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('cache-control'), 'no-store');
  assert.deepEqual(result.body.filters, { from: '2026-01-01', to: '2026-06-15', period: 'month', projectId: null });
  assert.equal(result.body.series.length, 6);
  assert.equal(result.body.completedProjectCount, 0);
  assert.equal(result.body.message, 'No completed projects match these filters.');
  assert.ok(result.body.totals.every(item => item.actual === null && item.occurrenceCount === 0));
});

test('US11 includes completed projects only, counts zero-benefit completions and avoids note-join multiplication', async () => {
  const server = await fixture.open({ reportToday: () => '2026-06-15' });
  const old = await fixture.project('Completed before the report', { completedOn: '2025-12-20' });
  const recent = await fixture.project('Completed without benefits', { completedOn: '2026-02-15' });
  const unfinished = await fixture.project('Not finished', { status: 'testing' });
  for (const note of ['Update one', 'Update two', 'Update three']) {
    await fixture.pool.query(`INSERT INTO project_progress_notes (project_id,author_id,body)
      SELECT $1,id,$2 FROM users WHERE email=$3`, [old, note, manager]);
  }
  await save(server, benefitInput(old, { recurrence: 'monthly', recursUntil: '2026-03-31' }));
  await save(server, benefitInput(old, { recurrence: 'monthly', recursUntil: '2026-03-31' })); // Equal amount, independent ID.
  await save(server, benefitInput(unfinished, { actual: 999999, estimated: 999999 }));
  const response = await request(server, path + window, { email: manager });
  assert.equal(response.status, 200);
  const report = response.body;
  assert.equal(report.completedProjectCount, 1);
  assert.equal(report.completedProjectsToDate, 2);
  assert.equal(report.benefitCount, 2);
  assert.equal(report.occurrenceCount, 6);
  assert.equal(total(report).estimated, '60.0000');
  assert.equal(total(report).actual, '48.0000');
  assert.equal(report.projects.find(item => item.projectId === recent).benefitCount, 0);
  assert.equal(report.projects.some(item => item.projectId === unfinished), false);
  assert.equal(report.series[1].completedProjectCount, 1);
  assert.equal(report.series.reduce((sum, item) => sum + item.completedProjectCount, 0), report.completedProjectCount);
  assert.deepEqual((await request(server, path + window, { email: manager })).body, report);
});

test('US11 project/date filters and rollups agree with the project-level breakdown', async () => {
  const server = await fixture.open({ reportToday: () => '2026-06-15' });
  const a = await fixture.project('Hours project');
  const b = await fixture.project('Financial project', { completedOn: '2026-02-01' });
  await save(server, benefitInput(a, { recurrence: 'monthly', recursUntil: '2026-03-31' }));
  await save(server, benefitInput(b, { date: '2026-02-15', unit: 'GBP/year', estimated: 100.125, actual: 80.0001 }));
  const all = (await request(server, path + window, { email: manager })).body;
  const filtered = (await request(server, path + window + '&projectId=' + b.toUpperCase(), { email: manager })).body;
  assert.equal(filtered.projects.length, 1);
  assert.equal(filtered.projects[0].projectId, b);
  assert.deepEqual(filtered.totals, all.projects.find(item => item.projectId === b).totals);
  assert.equal(total(filtered, 'GBP').actual, '80.0001');
  assert.equal(total(filtered).actual, null);
  const quarterly = (await request(server, path + '?from=2026-01-01&to=2026-03-31&period=quarter', { email: manager })).body;
  assert.deepEqual(quarterly.totals, all.totals);
  assert.equal(quarterly.series.length, 1);
  const dated = (await request(server, path + '?from=2026-02-16&to=2026-03-01', { email: manager })).body;
  assert.equal(total(dated, 'GBP').actual, null);
  assert.equal(total(dated).actual, '8.0000'); // Feb 28 only, no prorating.
  assert.equal(dated.completedProjectCount, 0);
});

test('US11 summaries read current edits, retain null/zero distinctions and do not accumulate previous versions', async () => {
  const server = await fixture.open({ reportToday: () => '2026-06-15' });
  const a = await fixture.project('Original project');
  const b = await fixture.project('New project');
  const created = await save(server, benefitInput(a, { recurrence: 'monthly', recursUntil: '2026-03-31', actual: null }));
  const first = (await request(server, path + window, { email: manager })).body;
  assert.equal(total(first).actual, null);
  assert.equal(first.missingActualCount, 3);
  const edit = benefitInput(b, { estimated: 2.5, actual: 0 }); // New schedule fields omitted: preserve the assigned schedule.
  delete edit.recurrence;
  delete edit.recursUntil;
  const update = await request(server, `/api/v1/benefits/${created.id}`, { email: manager, method: 'PUT', body: edit });
  assert.equal(update.status, 200);
  const report = (await request(server, path + window, { email: manager })).body;
  assert.equal(report.benefitCount, 1);
  assert.equal(report.projects.find(item => item.projectId === b).benefitCount, 1);
  assert.equal(report.projects.find(item => item.projectId === a).benefitCount, 0);
  assert.equal(total(report).estimated, '7.5000');
  assert.equal(total(report).actual, '0.0000');
  assert.equal(total(report).actualComplete, true);
  assert.equal(report.missingActualCount, 0);
});

test('US11 reports classification gaps and does not turn future actuals into delivered savings', async () => {
  const server = await fixture.open({ reportToday: () => '2026-02-15' });
  const id = await fixture.project('Incomplete reporting data');
  await save(server, benefitInput(id, { recurrence: 'unspecified' }));
  await save(server, benefitInput(id, { date: '2026-01-01', recurrence: 'monthly', recursUntil: '2026-03-01', estimated: 12, actual: 10 }));
  await save(server, benefitInput(id, { date: '2026-02-01', unit: 'Percent', estimated: 50, actual: null }));
  const report = (await request(server, path + window, { email: manager })).body;
  assert.equal(report.exclusions.unclassifiedBenefits.length, 1);
  assert.equal(total(report).estimated, '36.0000');
  assert.equal(total(report).actual, '20.0000');
  assert.equal(total(report).actualComplete, false);
  assert.equal(report.futureActualCount, 1);
  assert.equal(report.incomplete, true);
  assert.equal(report.projects[0].nonAdditiveBenefits[0].actual, null);
  assert.equal((await request(server, path + window + '&asOf=2030-01-01', { email: manager })).status, 400);
});

test('US11 exposes undated legacy completions as exclusions instead of inventing their date', async () => {
  const server = await fixture.open({ reportToday: () => '2026-06-15' });
  const id = await fixture.project('Legacy completed without history');
  // Simulate the nullable legacy state that the upgrade test constructs from the old schema.
  const client = await fixture.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('ALTER TABLE projects DISABLE TRIGGER projects_completed_at');
    await client.query('UPDATE projects SET completed_at=NULL WHERE id=$1', [id]);
    await client.query('ALTER TABLE projects ENABLE TRIGGER projects_completed_at');
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
  await save(server, benefitInput(id));
  const report = (await request(server, path + window, { email: manager })).body;
  assert.equal(report.completedProjectCount, 0);
  assert.equal(report.completedProjectsToDate, 0);
  assert.equal(report.occurrenceCount, 0);
  assert.equal(report.exclusions.undatedCompletedProjects[0].projectId, id);
  assert.match(report.message, /no reliable completion date/);
});

test('US11 rejects bad filter types/ranges, unknown projects and status-filter bypass attempts', async () => {
  const server = await fixture.open({ reportToday: () => '2026-06-15' });
  for (const query of [
    '?from=2026-01-01', '?to=2026-03-31', '?from=2026-02-30&to=2026-03-31',
    '?from=2026-04-01&to=2026-03-31', '?period=weekly', '?period=month&period=year',
    '?projectId=bad', '?projectId=one&projectId=two', '?status=all', '?limit=100',
    '?from=2016-01-01&to=2026-01-01'
  ]) {
    const response = await request(server, path + query, { email: manager });
    assert.equal(response.status, 400, query);
    assert.equal(response.body.code, 'VALIDATION_ERROR');
  }
  assert.equal((await request(server, path + window + '&projectId=' + randomUUID(), { email: manager })).status, 404);
  const unfinished = await fixture.project('Incomplete', { status: 'not_started' });
  const response = await request(server, path + window + '&projectId=' + unfinished, { email: manager });
  assert.equal(response.status, 200);
  assert.equal(response.body.completedProjectCount, 0);
  assert.equal(response.body.message, 'No completed projects match these filters.');
});
