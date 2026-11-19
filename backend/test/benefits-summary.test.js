import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aggregateBenefits } from '../src/benefits/summary.js';

function benefit(id, overrides = {}) {
  return {
    id, project_id: 'project-a', project_title: 'Booking automation',
    category: 'efficiency', description: 'Save administration time',
    measurement: 'Staff hours saved', estimated: '0.1000', actual: '0.2000',
    unit: 'Hours/month', date: '2026-11-18', ...overrides
  };
}
const total = (result, unit = 'Hours/month') => result.totals.find((item) => item.unit === unit);

test('summary separates estimates, actuals, units and projects with exact decimal arithmetic', () => {
  const result = aggregateBenefits([
    benefit('a'), benefit('b', { estimated: '0.2000', actual: '-0.1000' }),
    benefit('c', { unit: 'GBP/year', estimated: '100.0000', actual: '75.2500' }),
    benefit('d', { project_id: 'project-b', estimated: '1.0000', actual: '0.0000' }),
    benefit('e', { unit: 'Cases/month', estimated: '30.0000', actual: '25.0000' })
  ], 3);
  assert.equal(result.completedProjects, 3);
  assert.equal(result.projectCount, 2);
  assert.deepEqual(total(result), { unit: 'Hours/month', estimated: '1.3000', actual: '0.1000', benefitCount: 3 });
  assert.equal(total(result, 'GBP/year').actual, '75.2500');
  assert.equal(total(result, 'Cases/month').actual, '25.0000');
  assert.equal(total(result.projects[0]).estimated, '0.3000');
  assert.equal(result.totalBenefitsRecorded, 5);
  assert.equal(result.message, null);
});

test('a repeated identity counts once but equal amounts from distinct records both count', () => {
  const first = benefit('a');
  const result = aggregateBenefits([first, { ...first }, benefit('b')]);
  assert.equal(result.totalBenefitsRecorded, 2);
  assert.equal(result.projects[0].benefitCount, 2);
  assert.deepEqual(result.byCategory, [{ category: 'efficiency', count: 2 }]);
  assert.equal(total(result).estimated, '0.2000');
});

test('percentages and durations remain individual measures without misleading sums', () => {
  const result = aggregateBenefits([
    benefit('a', { unit: 'Percent', estimated: '50.0000', actual: '20.0000' }),
    benefit('b', { unit: 'Percent', estimated: '10.0000', actual: '30.0000' }),
    benefit('c', { unit: 'Days', estimated: '4.0000', actual: '2.0000' })
  ]);
  assert.equal(result.totalBenefitsRecorded, 3);
  assert.ok(result.totals.every((item) => item.estimated === '0.0000' && item.benefitCount === 0));
  assert.deepEqual(result.projects[0].nonAdditiveBenefits.map(({ unit, actual }) => [unit, actual]),
    [['Percent', '20.0000'], ['Percent', '30.0000'], ['Days', '2.0000']]);
  assert.equal(result.message, null);
});

test('empty records have zero totals, no projects and an explicit empty message', () => {
  const result = aggregateBenefits([], 2);
  assert.equal(result.completedProjects, 2);
  assert.equal(result.totalBenefitsRecorded, 0);
  assert.equal(result.projectCount, 0);
  assert.deepEqual(result.projects, []);
  assert.deepEqual(result.byCategory, []);
  assert.ok(result.totals.every((item) => item.estimated === '0.0000' && item.actual === '0.0000'));
  assert.equal(result.message, 'No benefits have been recorded yet.');
});

test('large totals and four-place fractions retain precision beyond safe JavaScript integers', () => {
  const result = aggregateBenefits(Array.from({ length: 10000 }, (_, id) =>
    benefit(String(id), { estimated: '999999999.9999', actual: '-999999999.9999' })));
  assert.equal(total(result).estimated, '9999999999999.0000');
  assert.equal(total(result).actual, '-9999999999999.0000');
});

test('replacing the saved value changes the total instead of adding an old version', () => {
  const saved = benefit('a', { estimated: '10.0000' });
  assert.equal(total(aggregateBenefits([saved])).estimated, '10.0000');
  assert.equal(total(aggregateBenefits([{ ...saved, estimated: '15.0000' }])).estimated, '15.0000');
});
