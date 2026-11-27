import { validBenefitDate, uuidPattern } from './validation.js';

const pad = number => String(number).padStart(2, '0');
const parts = date => date.split('-').map(Number);
const iso = (year, month, day) => `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`;
const daysInMonth = (year, month) => [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
export const monthIndex = date => { const [year, month] = parts(date); return year * 12 + month - 1; };

// Always shift from the original anchor: Jan 31 -> Feb 28 -> Mar 31, not Mar 28.
export function shiftMonths(date, months) {
  const index = monthIndex(date) + months;
  const year = Math.floor(index / 12);
  const month = index % 12 + 1;
  if (year < 1 || year > 9999) return null;
  return iso(year, month, Math.min(parts(date)[2], daysInMonth(year, month)));
}

export function periodBounds(date, period) {
  const [year, month] = parts(date);
  const size = period === 'year' ? 12 : period === 'quarter' ? 3 : 1;
  const firstMonth = Math.floor((month - 1) / size) * size + 1;
  const lastMonth = firstMonth + size - 1;
  return { start: iso(year, firstMonth, 1), end: iso(year, lastMonth, daysInMonth(year, lastMonth)), size };
}

export function periodKey(date, period) {
  const [year, month] = parts(date);
  return period === 'year' ? String(year).padStart(4, '0')
    : period === 'quarter' ? `${String(year).padStart(4, '0')}-Q${Math.ceil(month / 3)}`
      : date.slice(0, 7);
}

export function* recognitionDates(row, from, to) {
  if (row.recurrence === 'one_off') {
    if (row.date >= from && row.date <= to) yield row.date;
    return;
  }
  if (!['monthly', 'yearly'].includes(row.recurrence)) return;
  const end = row.recurs_until < to ? row.recurs_until : to;
  const step = row.recurrence === 'monthly' ? 1 : 12;
  let index = Math.max(0, Math.floor((monthIndex(from) - monthIndex(row.date)) / step));
  let date = shiftMonths(row.date, index * step);
  if (date && date < from) date = shiftMonths(row.date, ++index * step);
  while (date && date <= end) {
    yield date;
    date = shiftMonths(row.date, ++index * step);
  }
}

export function validateReportQuery(query, asOf) {
  const fields = {};
  const allowed = ['from', 'to', 'period', 'projectId'];
  if (Object.keys(query).some(key => !allowed.includes(key))) fields.query = 'Unknown report filter.';
  const providedDates = query.from !== undefined || query.to !== undefined;
  const from = providedDates ? query.from : `${asOf.slice(0, 4)}-01-01`;
  const to = providedDates ? query.to : asOf;
  if (!validBenefitDate(from)) fields.from = 'Provide both from and to as valid YYYY-MM-DD dates.';
  if (!validBenefitDate(to)) fields.to = 'Provide both from and to as valid YYYY-MM-DD dates.';
  if (!fields.from && !fields.to) {
    if (from > to) fields.to = 'Choose an end date on or after the start date.';
    else if (monthIndex(to) - monthIndex(from) >= 120) fields.to = 'Choose at most 120 calendar months.';
  }
  const period = query.period ?? 'month';
  if (!['month', 'quarter', 'year'].includes(period)) fields.period = 'Choose month, quarter or year.';
  const projectId = query.projectId;
  if (projectId !== undefined && (typeof projectId !== 'string' || !uuidPattern.test(projectId))) fields.projectId = 'Choose a valid project ID.';
  return { data: { from, to, period, projectId, asOf }, fields };
}
