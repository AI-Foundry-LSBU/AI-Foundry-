import { scaled, decimal } from './decimal.js';
import { periodBounds, periodKey, shiftMonths, recognitionDates } from './report-dates.js';

// The saved rate label describes one monthly/yearly amount. After an explicit
// recognition rule is assigned, dated occurrences are amounts in these units.
// No annual-to-monthly allocation, currency conversion or partial-period scaling.
const units = [
  { unit: 'Hours', sourceUnit: 'Hours/month' },
  { unit: 'GBP', sourceUnit: 'GBP/year' },
  { unit: 'Cases', sourceUnit: 'Cases/month' }
];
const inside = (date, from, to) => date >= from && date <= to;
const later = (a, b) => a > b ? a : b;
const byDateAndId = (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id);

function newTotals() {
  return units.map(item => ({ ...item, estimated: 0n, actual: 0n, ids: new Set(),
    occurrenceCount: 0, estimatedKnownCount: 0, actualKnownCount: 0,
    missingEstimatedCount: 0, missingActualCount: 0 }));
}

function add(totals, row, actual) {
  const total = totals.find(item => item.sourceUnit === row.unit);
  if (!total) return;
  total.ids.add(row.id);
  total.occurrenceCount++;
  if (row.estimated === null) total.missingEstimatedCount++;
  else { total.estimated += scaled(row.estimated); total.estimatedKnownCount++; }
  if (actual === null) total.missingActualCount++;
  else { total.actual += scaled(actual); total.actualKnownCount++; }
}

function outputTotals(totals) {
  return totals.map(({ ids, ...item }) => ({ ...item, benefitCount: ids.size,
    estimated: item.estimatedKnownCount ? decimal(item.estimated) : null,
    actual: item.actualKnownCount ? decimal(item.actual) : null,
    estimatedComplete: item.occurrenceCount > 0 && item.missingEstimatedCount === 0,
    actualComplete: item.occurrenceCount > 0 && item.missingActualCount === 0
  }));
}

function outputProject(project) {
  const { ids, ...item } = project;
  return { ...item, benefitCount: ids.size, totals: outputTotals(item.totals),
    nonAdditiveBenefits: item.nonAdditiveBenefits.sort(byDateAndId) };
}

export function aggregateBenefitsOverTime(records, { from, to, period, projectId, asOf }) {
  const cutoff = to < asOf ? to : asOf;
  const current = new Map(records.projects
    .filter(project => project.status === 'completed' && (!projectId || project.id.toLowerCase() === projectId.toLowerCase()))
    .map(project => [project.id, project]));
  const undatedCompletedProjects = [...current.values()].filter(project => !project.completed_on)
    .map(project => ({ projectId: project.id, project: project.project }))
    .sort((a, b) => a.projectId.localeCompare(b.projectId));
  const eligible = [...current.values()].filter(project => project.completed_on && project.completed_on <= cutoff);
  const projects = new Map(eligible.map(project => [project.id, {
    projectId: project.id, project: project.project, completedOn: project.completed_on,
    completedInWindow: inside(project.completed_on, from, to), ids: new Set(),
    occurrenceCount: 0, totals: newTotals(), nonAdditiveBenefits: []
  }]));

  const series = new Map();
  let bounds = periodBounds(from, period);
  while (bounds.start <= to) {
    const windowStart = later(bounds.start, from);
    const windowEnd = bounds.end < to ? bounds.end : to;
    const periodCutoff = windowEnd < asOf ? windowEnd : asOf;
    const key = periodKey(bounds.start, period);
    series.set(key, { period: key, from: windowStart, to: windowEnd,
      completedProjectCount: eligible.filter(project => inside(project.completed_on, windowStart, windowEnd)).length,
      completedProjectsToDate: eligible.filter(project => project.completed_on <= periodCutoff).length,
      ids: new Set(), occurrenceCount: 0, totals: newTotals(), nonAdditiveBenefits: [] });
    const next = shiftMonths(bounds.start, bounds.size);
    if (!next) break;
    bounds = periodBounds(next, period);
  }

  const totals = newTotals();
  const seen = new Set();
  const recognised = new Set();
  const unclassifiedBenefits = [];
  const beforeCompletionBenefits = [];
  let occurrenceCount = 0;
  let missingEstimatedCount = 0;
  let missingActualCount = 0;
  let futureActualCount = 0;

  for (const row of records.benefits) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    const project = projects.get(row.project_id);
    if (!project || row.date > to) continue;
    const detail = { id: row.id, projectId: row.project_id, project: project.project, description: row.description,
      measurement: row.measurement, unit: row.unit, date: row.date };
    if (row.recurrence === 'unspecified') {
      unclassifiedBenefits.push(detail);
      continue;
    }
    if (row.recurrence === 'one_off' && row.date < project.completedOn) {
      if (inside(row.date, from, to)) beforeCompletionBenefits.push(detail);
      continue;
    }
    for (const date of recognitionDates(row, later(from, project.completedOn), to)) {
      const bucket = series.get(periodKey(date, period));
      const actual = date > asOf ? null : row.actual;
      if (date > asOf && row.actual !== null) futureActualCount++;
      if (row.estimated === null) missingEstimatedCount++;
      if (actual === null) missingActualCount++;
      recognised.add(row.id);
      project.ids.add(row.id);
      bucket.ids.add(row.id);
      occurrenceCount++;
      project.occurrenceCount++;
      bucket.occurrenceCount++;
      add(totals, row, actual);
      add(project.totals, row, actual);
      add(bucket.totals, row, actual);
      if (!units.some(item => item.sourceUnit === row.unit)) {
        const measure = { ...detail, date, estimated: decimal(scaled(row.estimated)), actual: decimal(scaled(actual)) };
        project.nonAdditiveBenefits.push(measure);
        bucket.nonAdditiveBenefits.push(measure);
      }
    }
  }

  const breakdown = [...projects.values()].filter(project => project.completedInWindow || project.ids.size)
    .sort((a, b) => a.projectId.localeCompare(b.projectId)).map(outputProject);
  let message = null;
  if (!eligible.length && !undatedCompletedProjects.length) message = 'No completed projects match these filters.';
  else if (!eligible.length) message = 'Completed projects have no reliable completion date and are excluded from dated reporting.';
  else if (!occurrenceCount && unclassifiedBenefits.length) message = 'Benefits need an explicit recurrence rule before they can be included.';
  else if (!occurrenceCount) message = 'No benefits are recorded for completed projects in this reporting window.';

  return {
    filters: { from, to, period, projectId: projectId ?? null }, asOf,
    completedProjectCount: eligible.filter(project => inside(project.completed_on, from, to)).length,
    completedProjectsToDate: eligible.length,
    projectCount: breakdown.length, benefitCount: recognised.size, occurrenceCount,
    totals: outputTotals(totals),
    series: [...series.values()].map(({ ids, ...item }) => ({ ...item, benefitCount: ids.size,
      totals: outputTotals(item.totals), nonAdditiveBenefits: item.nonAdditiveBenefits.sort(byDateAndId) })),
    projects: breakdown,
    missingEstimatedCount, missingActualCount, futureActualCount,
    incomplete: Boolean(missingEstimatedCount || missingActualCount || unclassifiedBenefits.length || undatedCompletedProjects.length),
    exclusions: {
      undatedCompletedProjects,
      unclassifiedBenefits: unclassifiedBenefits.sort((a, b) => a.id.localeCompare(b.id)),
      beforeCompletionBenefits: beforeCompletionBenefits.sort((a, b) => a.id.localeCompare(b.id))
    }, message
  };
}
