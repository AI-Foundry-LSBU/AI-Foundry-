import { scaled, decimal } from './decimal.js';

const additiveUnits = ['Hours/month', 'GBP/year', 'Cases/month'];

function newTotals() {
  return additiveUnits.map((unit) => ({ unit, estimated: 0n, actual: 0n, benefitCount: 0 }));
}

function add(totals, row) {
  const total = totals.find(({ unit }) => unit === row.unit);
  if (!total) return;
  total.estimated += scaled(row.estimated) ?? 0n;
  total.actual += scaled(row.actual) ?? 0n;
  total.benefitCount += 1;
}

function outputTotals(totals) {
  return totals.map((total) => ({
    ...total, estimated: decimal(total.estimated), actual: decimal(total.actual)
  }));
}

export function aggregateBenefits(rows, completedProjects = 0) {
  const seen = new Set();
  const projects = new Map();
  const categories = new Map();
  const totals = newTotals();
  const missingValues = [];
  for (const row of rows) {
    // Identity, not amount, defines a record. Equal values can be legitimate.
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    if (row.estimated === null || row.actual === null) missingValues.push({
      id: row.id, projectId: row.project_id, unit: row.unit,
      estimatedMissing: row.estimated === null, actualMissing: row.actual === null
    });
    if (!projects.has(row.project_id)) {
      projects.set(row.project_id, {
        projectId: row.project_id, project: row.project_title, benefitCount: 0,
        totals: newTotals(), nonAdditiveBenefits: []
      });
    }
    const project = projects.get(row.project_id);
    project.benefitCount += 1;
    categories.set(row.category, (categories.get(row.category) ?? 0) + 1);
    add(totals, row);
    add(project.totals, row);
    // Percentages need denominators; days may describe unrelated durations.
    // Preserve both for comparison without inventing sums or averages.
    if (!additiveUnits.includes(row.unit)) {
      project.nonAdditiveBenefits.push({
        id: row.id, category: row.category, description: row.description,
        measurement: row.measurement, unit: row.unit,
        estimated: decimal(scaled(row.estimated)), actual: decimal(scaled(row.actual)),
        date: row.date
      });
    }
  }
  return {
    completedProjects,
    totalBenefitsRecorded: seen.size,
    projectCount: projects.size,
    byCategory: [...categories].sort(([a], [b]) => a.localeCompare(b))
      .map(([category, count]) => ({ category, count })),
    totals: outputTotals(totals),
    projects: [...projects.values()].sort((a, b) => a.projectId.localeCompare(b.projectId))
      .map((project) => ({ ...project, totals: outputTotals(project.totals) })),
    ...(missingValues.length ? { missingValues } : {}),
    message: seen.size === 0 ? 'No benefits have been recorded yet.' : null
  };
}
