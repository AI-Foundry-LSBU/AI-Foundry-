import { listSortOrders } from './queries.js';

const requiredTextLimits = {
  title: 150,
  department: 100,
  problemDescription: 2000,
  proposedImprovement: 2000
};

function readText(input, key, maxLength, fields, required = false) {
  if (input[key] === undefined && !required) return undefined;
  if (typeof input[key] !== 'string') {
    fields[key] = 'Enter a text value.';
    return undefined;
  }

  const value = input[key].trim();
  if (required && !value) fields[key] = 'This field is required.';
  else if (value.includes('\0')) fields[key] = 'Remove the null character.';
  else if (maxLength && [...value].length > maxLength) {
    fields[key] = `Use no more than ${maxLength} characters.`;
  }
  return value || undefined;
}

export function validateSubmission(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { fields: { body: 'Send a JSON object.' } };
  }

  const fields = {};
  const data = {};
  for (const [key, maxLength] of Object.entries(requiredTextLimits)) {
    data[key] = readText(input, key, maxLength, fields, true);
  }

  data.expectedBenefits = readText(input, 'expectedBenefits', 500, fields);
  data.source = input.source === undefined ? 'staff_submission' : input.source;

  if (!['staff_submission', 'hackathon'].includes(data.source)) {
    fields.source = 'Choose staff_submission or hackathon.';
  }

  if (input.hackathonName !== undefined && data.source !== 'hackathon') {
    fields.hackathonName = 'This field is only available for hackathon submissions.';
  } else {
    data.hackathonName = readText(input, 'hackathonName', undefined, fields);
  }

  return { data, fields };
}

function pageInteger(value, defaultValue) {
  if (value === undefined) return defaultValue;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return NaN;
  return Number(value);
}

export function validateListQuery(query) {
  const page = pageInteger(query.page, 1);
  const pageSize = pageInteger(query.pageSize, 20);
  const sort = query.sort === undefined ? '-submittedAt' : query.sort;
  const offset = (page - 1) * pageSize;
  const fields = {};

  if (!Number.isSafeInteger(page) || page < 1) fields.page = 'Use a positive integer.';
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    fields.pageSize = 'Use an integer from 1 to 100.';
  }
  if (!fields.page && !fields.pageSize && !Number.isSafeInteger(offset)) {
    fields.page = 'This page is too large.';
  }
  if (!listSortOrders.has(sort)) {
    fields.sort = 'Choose submittedAt, -submittedAt, priority or -priority.';
  }

  return { data: { page, pageSize, sort, offset }, fields };
}
