import { lsbuBrief, lsbuThemeLabels, lsbuThemes } from './university.js';

const recommendations = ['worth_pursuing', 'not_worth_it'];
const categories = ['efficiency', 'financial', 'service', 'risk_reduction', 'data', 'strategic'];
const units = ['Hours/month', 'GBP/year', 'Percent', 'Days', 'Cases/month'];
const opportunityCategories = ['automation', 'ai_assistant', 'reporting', 'process_improvement', 'other'];
const priorities = ['high', 'medium', 'low'];
const scoreFields = ['strategicAlignment', 'benefitPotential', 'complexity', 'resourceRequirements', 'speedToValue'];

const assessmentSchema = {
  type: 'object',
  additionalProperties: false,
  required: [...scoreFields, 'category', 'priority', 'notes'],
  properties: {
    strategicAlignment: { type: 'integer' },
    benefitPotential: { type: 'integer' },
    complexity: { type: 'integer' },
    resourceRequirements: { type: 'integer' },
    speedToValue: { type: 'integer' },
    category: { type: 'string', enum: opportunityCategories },
    priority: { type: 'string', enum: priorities },
    notes: { type: 'string' }
  }
};

const reviewSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['recommendation', 'summary', 'reason', 'similarTitle', 'lsbuTheme', 'benefits', 'assessment'],
  properties: {
    recommendation: { type: 'string', enum: recommendations },
    summary: { type: 'string' },
    reason: { type: 'string' },
    similarTitle: { type: ['string', 'null'] },
    lsbuTheme: { type: 'string', enum: lsbuThemes },
    assessment: assessmentSchema,
    benefits: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['category', 'description', 'unit', 'estimated', 'potential', 'current', 'proposed'],
        properties: {
          category: { type: 'string', enum: categories },
          description: { type: 'string' },
          unit: { type: 'string', enum: units },
          estimated: { type: ['number', 'null'] },
          potential: { type: 'integer' },
          current: { type: 'integer' },
          proposed: { type: 'integer' }
        }
      }
    }
  }
};

function failure(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

function text(value, limit) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes('\0') || [...trimmed].length > limit) return '';
  return trimmed;
}

export function normaliseBenefitReview(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  if (!recommendations.includes(value.recommendation)) return undefined;
  const summary = text(value.summary, 1200);
  const reason = text(value.reason, 1200);
  if (!summary || !reason) return undefined;
  const similar = value.similarTitle === null || value.similarTitle === undefined
    ? null
    : text(value.similarTitle, 200);
  if (value.similarTitle !== null && value.similarTitle !== undefined && !similar) return undefined;
  const benefits = value.recommendation === 'worth_pursuing' ? normaliseBenefits(value.benefits) : [];
  if (value.benefits !== undefined && benefits === undefined) return undefined;
  const assessment = normaliseAssessment(value.assessment);
  const theme = lsbuThemes.includes(value.lsbuTheme) ? value.lsbuTheme : undefined;
  const themedReason = theme ? reasonForTheme(theme, reason) : reason;
  return {
    recommendation: value.recommendation,
    summary,
    reason: themedReason,
    similarTitle: similar,
    benefits: benefits ?? [],
    ...(assessment ? { assessment } : {})
  };
}

function reasonForTheme(theme, reason) {
  const label = lsbuThemeLabels[theme];
  const lead = label
    ? `This connects to LSBU ${label}.`
    : 'This does not connect to an LSBU strategy theme.';
  if (reason.startsWith('This connects to LSBU') || reason.startsWith('This does not connect to an LSBU')) return reason;
  return `${lead} ${reason}`;
}

export function normaliseAssessment(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const scores = {};
  for (const field of scoreFields) {
    const score = value[field];
    if (!Number.isInteger(score) || score < 1 || score > 5) return undefined;
    scores[field] = score;
  }
  if (!opportunityCategories.includes(value.category) || !priorities.includes(value.priority)) return undefined;
  const notes = text(value.notes, 2000);
  if (!notes) return undefined;
  return { ...scores, category: value.category, priority: value.priority, notes };
}

function normaliseBenefits(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return undefined;
  const benefits = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return undefined;
    if (!categories.includes(item.category) || !units.includes(item.unit)) return undefined;
    const description = text(item.description, 400);
    if (!description) return undefined;
    let estimated = null;
    if (item.estimated !== null && item.estimated !== undefined) {
      if (typeof item.estimated !== 'number' || !Number.isFinite(item.estimated) || item.estimated < 0) return undefined;
      estimated = Math.round(item.estimated * 10000) / 10000;
    }
    let potential = null;
    if (item.potential !== null && item.potential !== undefined) {
      if (!Number.isInteger(item.potential) || item.potential < 1 || item.potential > 5) return undefined;
      potential = item.potential;
    }
    const score = (value) => {
      if (value === null || value === undefined) return null;
      if (!Number.isInteger(value) || value < 1 || value > 5) return undefined;
      return value;
    };
    const current = score(item.current);
    const proposed = score(item.proposed);
    if (current === undefined || proposed === undefined) return undefined;
    benefits.push({ category: item.category, description, unit: item.unit, estimated, potential, current, proposed });
  }
  return benefits;
}

export async function requestBenefitReview(opportunity, context = {}, {
  apiKey = process.env.OPENAI_API_KEY,
  model = process.env.OPENAI_MODEL || 'gpt-4o-mini',
  fetchImpl = fetch
} = {}) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) {
    throw failure(503, 'REVIEW_UNAVAILABLE', 'Benefit reviews are not configured.');
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
          json_schema: { name: 'benefit_review', strict: true, schema: reviewSchema }
        },
        messages: [
          {
            role: 'system',
            content: [
              'Before you judge, use this account of London South Bank University.',
              lsbuBrief,
              'The opportunity is an internal improvement for LSBU students, staff or services.',
              'You advise the LSBU Digital Project Manager before they approve or reject it.',
              'Score strategic alignment only by how directly it advances Pathways, Partnerships, Student Success, London, People or Technology, or makes an LSBU service simpler or more reliable for students or staff.',
              'Set lsbuTheme to the one Connecting theme this most directly serves: pathways, partnerships, student_success, london, people or technology.',
              'Use none only when the text does not help LSBU students, staff, teaching, or a university service.',
              'People covers staff time and how colleagues work. Student Success covers students, teaching, library and course administration. Technology covers a simpler system. London covers the Southwark and Croydon sites and the local community.',
              'Do not recite the whole university account. summary is two sentences about this opportunity at LSBU.',
              'Judge whether the description suggests benefits worth pursuing.',
              'Recommend not_worth_it only when the text describes no real improvement, or similarTitle names an existing opportunity that already does the same thing.',
              'similarTitle must be copied exactly from existingOpportunityTitles, never this opportunity’s own title. Use null when none of those titles does the same thing.',
              'If similarTitle is null, this opportunity is not already covered. Do not say that it overlaps, duplicates, or is already handled.',
              'A distinct improvement for LSBU students or staff is worth_pursuing.',
              'benefits lists each potential benefit described in the text when recommendation is worth_pursuing. Otherwise it is empty.',
              'A worth_pursuing review has at least one benefit, including a benefit with no stated quantity.',
              'estimated is a quantity only when the text states that number. Otherwise estimated is null. Do not invent hours, money, percentages, days or cases.',
              'potential is an integer from 1 to 5 for how substantial that benefit appears. 5 is the largest potential.',
              'current is 1 to 5 for the effort, delay or manual work in the process as it happens today. 5 is the heaviest.',
              'proposed is 1 to 5 for that same effort after this opportunity. It should be lower than current when the opportunity helps.',
              'current and proposed compare the same kind of effort. Do not turn them into hours or money.',
              'reason explains the recommendation.',
              'assessment scores the same opportunity for the manager. Each score is an integer from 1 to 5.',
              '5 means the strongest strategic alignment, the largest benefit, the highest complexity, the heaviest resource need, or the fastest speed to value.',
              'When recommendation is not_worth_it, benefitPotential is 1 or 2 and priority is low.',
              'category is the closest of automation, ai_assistant, reporting, process_improvement, other.',
              'notes is one or two sentences explaining the scores.'
            ].join(' ')
          },
          {
            role: 'user',
            content: JSON.stringify({
              title: opportunity.title,
              department: opportunity.department,
              problemDescription: opportunity.problemDescription,
              proposedImprovement: opportunity.proposedImprovement,
              expectedBenefits: opportunity.expectedBenefits || null,
              existingOpportunityTitles: context.existingOpportunityTitles ?? [],
              existingBenefitDescriptions: context.existingBenefitDescriptions ?? []
            })
          }
        ]
      })
    });
  } catch {
    throw failure(502, 'REVIEW_FAILED', 'The benefit review could not be created.');
  }

  if (!response.ok) throw failure(502, 'REVIEW_FAILED', 'The benefit review could not be created.');
  const body = await response.json().catch(() => null);
  let parsed;
  try {
    parsed = JSON.parse(body?.choices?.[0]?.message?.content ?? '');
  } catch {
    parsed = undefined;
  }
  const review = normaliseBenefitReview(parsed);
  if (!review) throw failure(502, 'REVIEW_FAILED', 'The benefit review could not be created.');
  return review;
}
