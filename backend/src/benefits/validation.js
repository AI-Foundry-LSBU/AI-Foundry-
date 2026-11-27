export const uuidPattern = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

const categories = ['efficiency', 'financial', 'service', 'risk_reduction', 'data', 'strategic'];
const units = ['Hours/month', 'GBP/year', 'Percent', 'Days', 'Cases/month'];
const textLimits = { description: 2000, measurement: 200, notes: 2000 };

export function validBenefitDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateBenefit(input, existing = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { fields: { body: 'Send a JSON object.' } };
  }

  const data = {};
  const fields = {};
  data.projectId = input.projectId;
  if (typeof data.projectId !== 'string' || !uuidPattern.test(data.projectId)) {
    fields.projectId = 'Choose a valid project.';
  }
  data.category = input.category;
  if (!categories.includes(data.category)) fields.category = 'Choose a valid benefit category.';
  data.unit = input.unit;
  if (!units.includes(data.unit)) fields.unit = 'Choose a valid unit.';

  for (const [field, limit] of Object.entries(textLimits)) {
    const value = input[field] === undefined && field === 'notes' ? '' : input[field];
    if (typeof value !== 'string') {
      fields[field] = 'Enter a text value.';
      continue;
    }
    data[field] = value.trim();
    if (field !== 'notes' && !data[field]) fields[field] = 'This field is required.';
    else if (data[field].includes('\0') || [...data[field]].length > limit) {
      fields[field] = `Use at most ${limit} characters and remove any null characters.`;
    }
  }

  for (const field of ['estimated', 'actual']) {
    const value = input[field];
    data[field] = value;
    if (value === null) continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 999999999.9999 ||
        Math.round(value * 10000) / 10000 !== value) {
      fields[field] = 'Enter a number from -999999999.9999 to 999999999.9999 with up to four decimal places.';
    }
  }

  if (!validBenefitDate(input.date)) {
    fields.date = 'Enter a valid date.';
  }
  data.date = input.date;
  // Older clients can edit existing fields without erasing an assigned schedule.
  data.recurrence = input.recurrence === undefined ? existing.recurrence ?? 'unspecified' : input.recurrence;
  data.recursUntil = input.recursUntil === undefined ? existing.recurs_until ?? null : input.recursUntil;
  if (!['unspecified', 'one_off', 'monthly', 'yearly'].includes(data.recurrence)) {
    fields.recurrence = 'Choose unspecified, one_off, monthly or yearly.';
  } else if (['monthly', 'yearly'].includes(data.recurrence)) {
    if (!validBenefitDate(data.recursUntil) || (validBenefitDate(data.date) && data.recursUntil < data.date)) {
      fields.recursUntil = 'Choose an inclusive end date on or after the first measurement date.';
    }
    if (data.recurrence === 'monthly' && !['Hours/month', 'Cases/month'].includes(data.unit)) {
      fields.unit = 'Monthly recurrence requires Hours/month or Cases/month.';
    }
    if (data.recurrence === 'yearly' && data.unit !== 'GBP/year') {
      fields.unit = 'Yearly recurrence requires GBP/year.';
    }
  } else if (data.recursUntil !== null) {
    fields.recursUntil = 'Use null for a one-off or unspecified benefit.';
  }
  return { data, fields };
}
