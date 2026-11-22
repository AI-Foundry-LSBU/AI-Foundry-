import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normaliseSuggestion, requestBenefitSuggestion } from '../src/benefits/suggest.js';

const draft = {
  category: 'efficiency',
  description: 'Staff would spend less time confirming bookings.',
  measurement: 'Hours saved confirming bookings',
  unit: 'Hours/month',
  estimated: 4.5
};

test('a suggestion keeps one allowed category, unit and a four-decimal estimate', () => {
  assert.deepEqual(normaliseSuggestion({ ...draft, estimated: 4.50001 }), { ...draft, estimated: 4.5 });
  assert.equal(normaliseSuggestion({ ...draft, estimated: null }).estimated, null);
  assert.equal(normaliseSuggestion({ ...draft, category: 'made-up' }), undefined);
  assert.equal(normaliseSuggestion({ ...draft, unit: 'widgets' }), undefined);
  assert.equal(normaliseSuggestion({ ...draft, description: '   ' }), undefined);
});

test('the OpenAI request uses the server key and returns the draft unchanged in shape', async () => {
  let seen;
  const suggestion = await requestBenefitSuggestion({
    title: 'Room bookings',
    department: 'Estates',
    problemDescription: 'Staff confirm every booking by hand.',
    proposedImprovement: 'Send the confirmation automatically.',
    expectedBenefits: 'Save about 4.5 hours a month.'
  }, {
    apiKey: 'test-key',
    model: 'test-model',
    fetchImpl: async (url, init) => {
      seen = { url, init };
      return new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify(draft) } }]
      }), { status: 200 });
    }
  });

  assert.equal(seen.url, 'https://api.openai.com/v1/chat/completions');
  assert.equal(seen.init.headers.Authorization, 'Bearer test-key');
  assert.equal(JSON.parse(seen.init.body).model, 'test-model');
  assert.deepEqual(suggestion, draft);
});

test('a missing key or an unusable reply does not expose the request', async () => {
  await assert.rejects(
    () => requestBenefitSuggestion({}, { apiKey: '   ', fetchImpl: () => { throw new Error('called'); } }),
    { status: 503, code: 'SUGGESTION_UNAVAILABLE' }
  );
  await assert.rejects(
    () => requestBenefitSuggestion({}, {
      apiKey: 'secret-key',
      fetchImpl: async () => new Response('no', { status: 401 })
    }),
    (error) => error.status === 502 && error.code === 'SUGGESTION_FAILED' && !error.message.includes('secret-key')
  );
});
