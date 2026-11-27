import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aggregateBenefitsOverTime } from '../src/benefits/report.js';
import { recognitionDates, validateReportQuery } from '../src/benefits/report-dates.js';

const project = (id = 'p1', completed_on = '2025-12-01', extra = {}) => ({ id, project: `Project ${id}`, status: 'completed', completed_on, ...extra });
const benefit = (id = 'b1', extra = {}) => ({ id, project_id: 'p1', category: 'efficiency',
  description: 'Independent saved work', measurement: 'Hours', unit: 'Hours/month',
  estimated: '10.0000', actual: '8.0000', date: '2026-01-31', recurrence: 'one_off', recurs_until: null, ...extra });
const filters = extra => ({ from: '2026-01-01', to: '2026-03-31', period: 'month', asOf: '2026-03-31', ...extra });
const total = (report, unit = 'Hours') => report.totals.find(item => item.unit === unit);
const aggregate = (benefits, extra = {}, projects = [project()]) => aggregateBenefitsOverTime({ projects, benefits }, filters(extra));

test('US11 separates new completion counts, older completed projects, exact values and units', () => {
  const recurring = benefit('b1', { estimated: '0.1000', actual: '0.2000', recurrence: 'monthly', recurs_until: '2026-03-31' });
  const report = aggregate([
    recurring, { ...recurring },
    benefit('money', { unit: 'GBP/year', estimated: '100.0000', actual: '80.0000', date: '2026-02-15' }),
    benefit('percent', { project_id: 'p2', unit: 'Percent', estimated: '50.0000', actual: '40.0000', date: '2026-02-20' }),
    benefit('cases', { project_id: 'p2', unit: 'Cases/month', estimated: '5.0000', actual: null, date: '2026-02-01', recurrence: 'monthly', recurs_until: '2026-03-01' }),
    benefit('unfinished', { project_id: 'p3', actual: '999999.0000' }),
    benefit('later', { project_id: 'p4', actual: '999999.0000' })
  ], {}, [project(), project('p2', '2026-02-01'), project('p3', null, { status: 'in_progress' }), project('p4', '2026-04-01')]);
  assert.equal(report.completedProjectCount, 1);
  assert.equal(report.completedProjectsToDate, 2);
  assert.equal(report.projectCount, 2);
  assert.equal(report.benefitCount, 4);
  assert.equal(report.occurrenceCount, 7);
  assert.equal(total(report).estimated, '0.3000');
  assert.equal(total(report).actual, '0.6000');
  assert.equal(total(report).sourceUnit, 'Hours/month');
  assert.equal(total(report, 'GBP').actual, '80.0000');
  assert.equal(total(report, 'Cases').estimated, '10.0000');
  assert.equal(total(report, 'Cases').actual, null);
  assert.equal(report.projects.find(item => item.projectId === 'p2').nonAdditiveBenefits[0].actual, '40.0000');
  assert.deepEqual(report.series.map(item => item.completedProjectCount), [0, 1, 0]);
  assert.equal(report.series.reduce((sum, item) => sum + item.completedProjectCount, 0), report.completedProjectCount);
});

test('US11 month ends, leap anniversaries and inclusive ends use the original anchor without drift', () => {
  const monthly = benefit('m', { recurrence: 'monthly', recurs_until: '2026-04-30' });
  assert.deepEqual([...recognitionDates(monthly, '2026-01-01', '2026-12-31')], ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  const annual = benefit('y', { date: '2024-02-29', unit: 'GBP/year', recurrence: 'yearly', recurs_until: '2028-02-29' });
  assert.deepEqual([...recognitionDates(annual, '2024-01-01', '2028-12-31')], ['2024-02-29', '2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29']);
  assert.deepEqual([...recognitionDates(annual, '2025-03-01', '2026-01-31')], []);
  assert.deepEqual([...recognitionDates(monthly, '2026-02-28', '2026-02-28')], ['2026-02-28']);
});

test('US11 partial date windows clip occurrences without prorating values and retain empty calendar buckets', () => {
  const report = aggregate([
    benefit('m', { recurrence: 'monthly', recurs_until: '2026-12-31' }),
    benefit('first', { date: '2026-02-10' }), benefit('last', { date: '2026-03-09' }),
    benefit('outside', { date: '2026-03-10' })
  ], { from: '2026-02-10', to: '2026-03-09' });
  assert.equal(report.occurrenceCount, 3);
  assert.equal(total(report).actual, '24.0000');
  assert.deepEqual(report.series.map(item => [item.period, item.from, item.to, item.occurrenceCount]), [
    ['2026-02', '2026-02-10', '2026-02-28', 2], ['2026-03', '2026-03-01', '2026-03-09', 1]
  ]);
  const empty = aggregate([], { from: '2026-02-10', to: '2026-03-09' });
  assert.equal(empty.series.length, 2);
  assert.ok(empty.series.every(item => total(item).actual === null && item.occurrenceCount === 0));
});

test('US11 counts each benefit identity once, retains equal independent amounts and replaces edits', () => {
  const a = benefit('a');
  const report = aggregate([a, { ...a }, benefit('b')]);
  assert.equal(report.benefitCount, 2);
  assert.equal(report.occurrenceCount, 2);
  assert.equal(total(report).actual, '16.0000');
  assert.equal(total(aggregate([{ ...a, actual: '3.1250' }])).actual, '3.1250');
});

test('US11 distinguishes no data, missing measurements, partial subtotals and explicit zero', () => {
  const missing = aggregate([benefit('missing', { estimated: null, actual: null })]);
  assert.equal(total(missing).estimated, null);
  assert.equal(total(missing).actual, null);
  assert.equal(missing.missingActualCount, 1);
  const zero = aggregate([benefit('zero', { estimated: '0.0000', actual: '0.0000' })]);
  assert.equal(total(zero).actual, '0.0000');
  assert.equal(total(zero).actualComplete, true);
  assert.equal(zero.incomplete, false);
  const partial = aggregate([benefit('known'), benefit('unknown', { actual: null })]);
  assert.equal(total(partial).actual, '8.0000');
  assert.equal(total(partial).actualKnownCount, 1);
  assert.equal(total(partial).missingActualCount, 1);
  assert.equal(total(partial).actualComplete, false);
  assert.equal(partial.incomplete, true);
});

test('US11 future occurrences can contain estimates but never reported actual savings', () => {
  const report = aggregate([benefit('future', { date: '2026-01-01', estimated: '12.0000', actual: '10.0000', recurrence: 'monthly', recurs_until: '2026-03-01' })], { asOf: '2026-02-15' });
  assert.equal(total(report).estimated, '36.0000');
  assert.equal(total(report).actual, '20.0000');
  assert.equal(total(report).actualComplete, false);
  assert.equal(report.futureActualCount, 1);
  assert.equal(report.missingActualCount, 1);
  assert.equal(total(report.series[2]).actual, null);
});

test('US11 unspecified recurrence and unreliable completion dates are flagged rather than guessed', () => {
  const report = aggregate([
    benefit('unknown-rule', { recurrence: 'unspecified' }),
    benefit('undated-project', { project_id: 'p2' }),
    benefit('pre-completion', { project_id: 'p3', date: '2026-01-15' })
  ], {}, [project(), project('p2', null), project('p3', '2026-02-01')]);
  assert.equal(report.occurrenceCount, 0);
  assert.equal(report.completedProjectCount, 1);
  assert.equal(report.completedProjectsToDate, 2);
  assert.equal(report.exclusions.unclassifiedBenefits[0].id, 'unknown-rule');
  assert.equal(report.exclusions.undatedCompletedProjects[0].projectId, 'p2');
  assert.equal(report.exclusions.beforeCompletionBenefits[0].id, 'pre-completion');
  assert.equal(report.projects[0].projectId, 'p3'); // Completion counts even without benefits.
  assert.equal(report.projects[0].benefitCount, 0);
  assert.equal(total(report).actual, null);
  assert.equal(report.incomplete, true);
  assert.match(report.message, /explicit recurrence/);
  const unknownOnly = aggregate([], {}, [project('legacy', null)]);
  assert.match(unknownOnly.message, /no reliable completion date/);
});

test('US11 ignores recurring occurrences before completion and keeps non-additive measurements separate', () => {
  const report = aggregate([
    benefit('monthly', { date: '2026-01-01', recurrence: 'monthly', recurs_until: '2026-03-01' }),
    benefit('percent', { date: '2026-02-20', unit: 'Percent', estimated: '30.0000', actual: null }),
    benefit('days', { date: '2026-03-01', unit: 'Days', estimated: '2.0000', actual: '0.0000' })
  ], {}, [project('p1', '2026-02-15')]);
  assert.equal(total(report).occurrenceCount, 1);
  assert.equal(total(report).actual, '8.0000');
  assert.deepEqual(report.projects[0].nonAdditiveBenefits.map(item => [item.unit, item.actual]), [['Percent', null], ['Days', '0.0000']]);
  assert.equal(report.occurrenceCount, 3);
});

test('US11 monthly, quarterly and yearly grouping keep the same portfolio values', () => {
  const rows = [benefit('m', { recurrence: 'monthly', recurs_until: '2026-12-31' }), benefit('signed', { actual: '-0.0001', estimated: '0.0001' })];
  const options = { from: '2026-01-01', to: '2026-12-31', asOf: '2026-12-31' };
  const monthly = aggregate(rows, { ...options, period: 'month' });
  const quarterly = aggregate(rows, { ...options, period: 'quarter' });
  const yearly = aggregate(rows, { ...options, period: 'year' });
  assert.equal(monthly.series.length, 12);
  assert.deepEqual(quarterly.series.map(item => item.period), ['2026-Q1', '2026-Q2', '2026-Q3', '2026-Q4']);
  assert.equal(yearly.series.length, 1);
  assert.deepEqual(monthly.totals, quarterly.totals);
  assert.deepEqual(monthly.totals, yearly.totals);
  assert.equal(total(monthly).actual, '95.9999');
});

test('US11 large exact totals preserve four-place precision without numeric rounding', () => {
  const report = aggregate(Array.from({ length: 10000 }, (_, id) => benefit(String(id), { estimated: '999999999.9999', actual: '-999999999.9999' })));
  assert.equal(total(report).estimated, '9999999999999.0000');
  assert.equal(total(report).actual, '-9999999999999.0000');
});

test('US11 validates dates, filter types and bounded reporting windows', () => {
  assert.deepEqual(validateReportQuery({}, '2026-06-15').data, filters({ from: '2026-01-01', to: '2026-06-15', asOf: '2026-06-15', projectId: undefined }));
  for (const input of [
    { from: '2026-01-01' }, { to: '2026-03-31' },
    { from: '2026-02-30', to: '2026-03-31' }, { from: '2026-04-01', to: '2026-03-31' },
    { from: ['2026-01-01'], to: '2026-03-31' }, { from: '2026-01-01T00:00:00Z', to: '2026-03-31' },
    { period: 'week' }, { period: ['month'] }, { projectId: 'bad' }, { status: 'all' },
    { from: '2016-01-01', to: '2026-01-01' }, { from: '0000-01-01', to: '0001-01-01' }
  ]) assert.ok(Object.keys(validateReportQuery(input, '2026-06-15').fields).length, JSON.stringify(input));
  assert.deepEqual(validateReportQuery({ from: '2016-01-01', to: '2025-12-31' }, '2026-06-15').fields, {});
});
