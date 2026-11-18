// Values from PostgreSQL numeric(13,4) remain strings until calculation.
// Integer ten-thousandths avoid floating-point errors such as 0.1 + 0.2.
const additiveUnits = ['Hours/month', 'GBP/year', 'Cases/month'];

function scaled(value) {
  const negative = value.startsWith('-');
  const [whole, fraction = ''] = value.replace(/^-/, '').split('.');
  const amount = BigInt(whole) * 10000n + BigInt(fraction.padEnd(4, '0'));
  return negative ? -amount : amount;
}

function decimal(value) {
  const absolute = value < 0n ? -value : value;
  return `${value < 0n ? '-' : ''}${absolute / 10000n}.${String(absolute % 10000n).padStart(4, '0')}`;
}

function newTotals() {
  return additiveUnits.map((unit) => ({ unit, estimated: 0n, actual: 0n, benefitCount: 0 }));
}

function add(totals, row) {
  const total = totals.find(({ unit }) => unit === row.unit);
  if (!total) return;
  total.estimated += scaled(row.estimated);
  total.actual += scaled(row.actual);
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
  for (const row of rows) {
    // Identity, not amount, defines a record. Equal values can be legitimate.
    if (seen.has(row.id)) continue;
    seen.add(row.id);
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
    message: seen.size === 0 ? 'No benefits have been recorded yet.' : null
  };
}
