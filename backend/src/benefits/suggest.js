import { lsbuBrief } from './university.js';

const categories = ['efficiency', 'financial', 'service', 'risk_reduction', 'data', 'strategic'];
const units = ['Hours/month', 'GBP/year', 'Percent', 'Days', 'Cases/month'];

const suggestionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['category', 'description', 'measurement', 'unit', 'estimated'],
  properties: {
    category: { type: 'string', enum: categories },
    description: { type: 'string' },
    measurement: { type: 'string' },
    unit: { type: 'string', enum: units },
    estimated: { type: ['number', 'null'] }
  }
};

function failure(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

export function normaliseSuggestion(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const description = typeof value.description === 'string' ? value.description.trim() : '';
  const measurement = typeof value.measurement === 'string' ? value.measurement.trim() : '';
  if (!categories.includes(value.category) || !units.includes(value.unit)) return undefined;
  if (!description || !measurement || description.includes('\0') || measurement.includes('\0')) return undefined;
  if ([...description].length > 2000 || [...measurement].length > 200) return undefined;

  let estimated = null;
  if (value.estimated !== null && value.estimated !== undefined) {
    const number = typeof value.estimated === 'number' ? value.estimated : Number(value.estimated);
    if (!Number.isFinite(number) || Math.abs(number) > 999999999.9999) return undefined;
    estimated = Math.round(number * 10000) / 10000;
  }
  return { category: value.category, description, measurement, unit: value.unit, estimated };
}

export async function requestBenefitSuggestion(opportunity, {
  apiKey = process.env.OPENAI_API_KEY,
  model = process.env.OPENAI_MODEL || 'gpt-4o-mini',
  fetchImpl = fetch
} = {}) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) {
    throw failure(503, 'SUGGESTION_UNAVAILABLE', 'Benefit suggestions are not configured.');
  }

  let response;
  try {
    response = await fetchImpl('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: AbortSignal.timeout(20000),
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'benefit_suggestion', strict: true, schema: suggestionSchema }
        },
        messages: [
          {
            role: 'system',
            content: [
              'The opportunity is an internal improvement at London South Bank University.',
              lsbuBrief,
              'Suggest one measurable benefit for that LSBU opportunity.',
              'Use only the supplied opportunity text for quantities. Do not invent a quantity the text does not support.',
              'Set estimated to null when the text does not state or clearly imply a number.',
              'description is one or two sentences. measurement names what the number counts.'
            ].join(' ')
          },
          {
            role: 'user',
            content: JSON.stringify({
              title: opportunity.title,
              department: opportunity.department,
              problemDescription: opportunity.problemDescription,
              proposedImprovement: opportunity.proposedImprovement,
              expectedBenefits: opportunity.expectedBenefits || null
            })
          }
        ]
      })
    });
  } catch {
    throw failure(502, 'SUGGESTION_FAILED', 'The benefit suggestion could not be created.');
  }

  if (!response.ok) {
    throw failure(502, 'SUGGESTION_FAILED', 'The benefit suggestion could not be created.');
  }

  const body = await response.json().catch(() => null);
  let parsed;
  try {
    parsed = JSON.parse(body?.choices?.[0]?.message?.content ?? '');
  } catch {
    parsed = undefined;
  }
  const suggestion = normaliseSuggestion(parsed);
  if (!suggestion) throw failure(502, 'SUGGESTION_FAILED', 'The benefit suggestion could not be created.');
  return suggestion;
}
