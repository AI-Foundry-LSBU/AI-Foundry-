import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normaliseSolutionCheck, requestSolutionCheck } from '../src/solutions/check.js';

const candidates = [{ id: '11111111-1111-4111-8111-111111111111', name: 'Library search',
  description: 'Search books and e-books.', keywords: ['books'], href: 'https://example.com/library',
  verification_notes: 'MANAGER-ONLY VERIFICATION NOTE', verified_by: 'PRIVATE-ACCOUNT-ID' }];
const id = candidates[0].id;
const answer = { decision: 'match', question: null, matches: [{ id, reason: 'Searches books and e-books.' }] };
const completion = (value, extra = {}) => new Response(JSON.stringify({ choices: [{
  finish_reason: 'stop', message: { content: JSON.stringify(value) }, ...extra
}] }), { status: 200 });

test('US10 normalisation accepts only candidate IDs, deduplicates and never keeps model links', () => {
  assert.deepEqual(normaliseSolutionCheck({ ...answer, matches: [...answer.matches, ...answer.matches,
    { id: 'invented', reason: 'An invented service.' }].map((entry) => ({ ...entry, href: 'https://evil.example' })) }, candidates), answer);
  assert.deepEqual(normaliseSolutionCheck({ ...answer, decision: 'none' }, candidates), { decision: 'none', question: null, matches: [] });
  assert.deepEqual(normaliseSolutionCheck({ ...answer, matches: [{ id: 'hidden-entry', reason: 'Hidden.' }] }, candidates), { decision: 'none', question: null, matches: [] });
  assert.deepEqual(normaliseSolutionCheck(answer), { decision: 'none', question: null, matches: [] });
  assert.equal(normaliseSolutionCheck({ decision: 'maybe', matches: [] }, candidates), undefined);
  assert.equal(normaliseSolutionCheck({ ...answer, matches: [null] }, candidates), undefined);
  assert.equal(normaliseSolutionCheck({ decision: 'clarify', question: '', matches: [] }, candidates), undefined);
  assert.equal(normaliseSolutionCheck({ decision: 'clarify', question: 'Open https://evil.example', matches: [] }, candidates), undefined);
  assert.deepEqual(normaliseSolutionCheck({ ...answer, matches: [{ id, reason: 'Use https://evil.example' }] }, candidates), { decision: 'none', question: null, matches: [] });
});

test('US10 OpenAI receives bounded candidate IDs and conversation, but no access links, verification metadata or API key in the prompt', async () => {
  let seen;
  const previousMessages = [{ role: 'user', text: 'I need resources.' }, { role: 'assistant', text: 'What resources?' }];
  const result = await requestSolutionCheck('online books', { candidates, previousMessages,
    apiKey: 'unit-test-private-key', model: 'test-model', fetchImpl: async (url, init) => {
      seen = { url, init, body: JSON.parse(init.body) };
      return completion(answer);
    }
  });
  assert.deepEqual(result, answer);
  assert.equal(seen.url, 'https://api.openai.com/v1/chat/completions');
  assert.equal(seen.init.headers.Authorization, 'Bearer unit-test-private-key');
  assert.equal(seen.body.model, 'test-model');
  assert.equal(seen.body.store, false);
  assert.equal(seen.body.max_completion_tokens, 500);
  assert.ok(seen.init.signal instanceof AbortSignal);
  const prompt = JSON.stringify(seen.body.messages);
  for (const secret of ['unit-test-private-key', 'MANAGER-ONLY VERIFICATION NOTE', 'PRIVATE-ACCOUNT-ID', candidates[0].href]) assert.equal(prompt.includes(secret), false);
  assert.deepEqual(JSON.parse(seen.body.messages[1].content).previousMessages, previousMessages);
  assert.deepEqual(seen.body.response_format.json_schema.schema.properties.matches.items.properties.id.enum, [id]);
});

test('US10 clarification returns the specific question and empty catalogues do not call the AI provider', async () => {
  const expected = { decision: 'clarify', question: 'Are you searching for books or booking a room?', matches: [] };
  assert.deepEqual(await requestSolutionCheck('library problem', { candidates, apiKey: 'test', fetchImpl: async () => completion(expected) }), expected);
  let calls = 0;
  assert.deepEqual(await requestSolutionCheck('anything', { candidates: [], apiKey: '', fetchImpl: async () => { calls++; } }), { decision: 'none', question: null, matches: [] });
  assert.equal(calls, 0);
});

test('US10 missing keys, provider errors, refusal, timeout and malformed output fail without leaking provider content', async () => {
  await assert.rejects(() => requestSolutionCheck('books', { candidates, apiKey: '' }), (error) => error.status === 503);
  const failures = [
    async () => new Response('API-SECRET error details', { status: 401 }),
    async () => new Response('API-SECRET quota details', { status: 429 }),
    async () => { throw new Error('API-SECRET network failure'); },
    async () => { throw new DOMException('API-SECRET timeout', 'TimeoutError'); },
    async () => new Response('not JSON', { status: 200 }),
    async () => completion({ decision: 'invalid', matches: [] }),
    async () => completion(answer, { message: { refusal: 'API-SECRET refusal' } }),
    async () => completion(answer, { finish_reason: 'length' })
  ];
  for (const fetchImpl of failures) {
    await assert.rejects(() => requestSolutionCheck('books', { candidates, apiKey: 'API-SECRET', fetchImpl }),
      (error) => error.status === 502 && !error.message.includes('API-SECRET'));
  }
});
