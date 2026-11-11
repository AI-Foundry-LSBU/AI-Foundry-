export const uuidPattern = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

const categories = ['efficiency', 'financial', 'service', 'risk_reduction', 'data', 'strategic'];
const units = ['Hours/month', 'GBP/year', 'Percent', 'Days', 'Cases/month'];
const textLimits = { description: 2000, measurement: 200, notes: 2000 };

export function validateBenefit(input) {
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
    if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 999999999.9999 ||
        Math.round(value * 10000) / 10000 !== value) {
      fields[field] = 'Enter a number from -999999999.9999 to 999999999.9999 with up to four decimal places.';
    }
  }

  const date = typeof input.date === 'string' ? new Date(input.date) : new Date(NaN);
  if (typeof input.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.date) ||
      input.date.startsWith('0000') || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== input.date) {
    fields.date = 'Enter a valid date.';
  }
  data.date = input.date;
  return { data, fields };
}
