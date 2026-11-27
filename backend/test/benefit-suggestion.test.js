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

test('the Gemini request uses the server key and returns the draft unchanged in shape', async () => {
  let seen;
  const suggestion = await requestBenefitSuggestion({
    title: 'Room bookings',
    department: 'Estates',
    problemDescription: 'Staff confirm every booking by hand.',
    proposedImprovement: 'Send the confirmation automatically.',
    expectedBenefits: 'Save about 4.5 hours a month.'
  }, {
    apiKey: 'test-key',
    model: 'gemini-3.5-flash-lite',
    fetchImpl: async (url, init) => {
      seen = { url, init };
      return new Response(JSON.stringify({
        candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(draft) }] } }]
      }), { status: 200 });
    }
  });

  assert.equal(seen.url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent');
  assert.equal(seen.init.headers['x-goog-api-key'], 'test-key');
  assert.equal(seen.init.headers.Authorization, undefined);
  const body = JSON.parse(seen.init.body);
  assert.equal(body.generationConfig.maxOutputTokens, 1024);
  assert.equal(body.generationConfig.responseMimeType, 'application/json');
  assert.equal(JSON.stringify(body).includes('test-key'), false);
  assert.equal(JSON.parse(body.contents[0].parts[0].text).title, 'Room bookings');
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
