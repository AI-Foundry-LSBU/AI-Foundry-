import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normaliseBenefitReview, requestBenefitReview } from '../src/benefits/review.js';
import { requestBenefitSuggestion } from '../src/benefits/suggest.js';

const opportunity = { title: 'Booking confirmations', department: 'Estates',
  problemDescription: 'Staff send booking confirmations manually.',
  proposedImprovement: 'Send confirmations automatically.', expectedBenefits: 'Save staff time.' };
const draft = {
  recommendation: 'worth_pursuing', summary: 'Automated confirmations could simplify the process.',
  reason: 'Staff would have fewer manual tasks.', similarTitle: null, lsbuTheme: 'people',
  benefits: [{ category: 'efficiency', description: 'Less manual confirmation work.', unit: 'Hours/month',
    estimated: null, potential: 3, current: 4, proposed: 2 }],
  assessment: { strategicAlignment: 4, benefitPotential: 3, complexity: 2,
    resourceRequirements: 2, speedToValue: 4, category: 'automation', priority: 'medium',
    notes: 'A bounded automation task with a measurable staff benefit.' }
};

test('benefit review uses Gemini structured JSON and preserves the existing validated response', async () => {
  let seen;
  const result = await requestBenefitReview(opportunity, {
    existingOpportunityTitles: ['Existing room workflow'], existingBenefitDescriptions: ['Less retyping.']
  }, { apiKey: 'FAKE-REVIEW-KEY', fetchImpl: async (url, init) => {
    seen = { url, init, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP',
      content: { parts: [{ text: JSON.stringify(draft) }] } }] }));
  } });
  assert.deepEqual(result, normaliseBenefitReview(draft));
  assert.ok(seen.url.startsWith('https://generativelanguage.googleapis.com/'));
  assert.equal(seen.init.headers['x-goog-api-key'], 'FAKE-REVIEW-KEY');
  assert.equal(seen.body.generationConfig.maxOutputTokens, 4096);
  assert.equal(JSON.stringify(seen.body).includes('FAKE-REVIEW-KEY'), false);
  const input = JSON.parse(seen.body.contents[0].parts[0].text);
  assert.deepEqual(input.existingOpportunityTitles, ['Existing room workflow']);
  assert.equal(input.title, opportunity.title);
  assert.match(seen.body.systemInstruction.parts[0].text, /Do not invent hours/);
});

test('both benefit helpers stop on Gemini quota exhaustion with feature-specific safe errors', async () => {
  for (const [run, code] of [
    [(options) => requestBenefitSuggestion(opportunity, options), 'SUGGESTION_UNAVAILABLE'],
    [(options) => requestBenefitReview(opportunity, {}, options), 'REVIEW_UNAVAILABLE']
  ]) {
    let calls = 0;
    await assert.rejects(() => run({ apiKey: 'FAKE-SECRET', fetchImpl: async () => {
      calls++;
      return new Response('FAKE-SECRET private quota details', { status: 429 });
    } }), error => error.status === 503 && error.code === code && !error.message.includes('FAKE-SECRET'));
    assert.equal(calls, 1);
  }
});

test('benefit review rejects refused, truncated, malformed or semantically invalid Gemini output', async () => {
  for (const candidate of [
    { finishReason: 'SAFETY', content: { parts: [{ text: JSON.stringify(draft) }] } },
    { finishReason: 'MAX_TOKENS', content: { parts: [{ text: JSON.stringify(draft) }] } },
    { finishReason: 'STOP', content: { parts: [{ text: 'invalid JSON' }] } },
    { finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ ...draft, recommendation: 'invented' }) }] } }
  ]) {
    await assert.rejects(() => requestBenefitReview(opportunity, {}, {
      apiKey: 'FAKE-SECRET', fetchImpl: async () => new Response(JSON.stringify({ candidates: [candidate] }))
    }), { status: 502, code: 'REVIEW_FAILED' });
  }
});

test('benefit helpers ignore retired OpenAI credentials and do not make requests in production', async () => {
  const saved = { gemini: process.env.GEMINI_API_KEY, openai: process.env.OPENAI_API_KEY, mode: process.env.NODE_ENV };
  let calls = 0;
  const fetchImpl = async () => { calls++; throw new Error('Unexpected request'); };
  try {
    delete process.env.GEMINI_API_KEY;
    process.env.OPENAI_API_KEY = 'FAKE-RETIRED-KEY';
    await assert.rejects(() => requestBenefitSuggestion(opportunity, { fetchImpl }), { status: 503, code: 'SUGGESTION_UNAVAILABLE' });
    await assert.rejects(() => requestBenefitReview(opportunity, {}, { fetchImpl }), { status: 503, code: 'REVIEW_UNAVAILABLE' });
    process.env.NODE_ENV = 'production';
    await assert.rejects(() => requestBenefitSuggestion(opportunity, { apiKey: 'FAKE', fetchImpl }), { status: 503 });
    await assert.rejects(() => requestBenefitReview(opportunity, {}, { apiKey: 'FAKE', fetchImpl }), { status: 503 });
    assert.equal(calls, 0);
  } finally {
    for (const [name, value] of [['GEMINI_API_KEY', saved.gemini], ['OPENAI_API_KEY', saved.openai], ['NODE_ENV', saved.mode]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});
