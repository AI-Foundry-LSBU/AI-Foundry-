import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normaliseSolutionCheck, requestSolutionCheck } from '../src/solutions/check.js';

const candidates = [{ id: '11111111-1111-4111-8111-111111111111', name: 'Library search',
  description: 'Search books and e-books.', keywords: ['books'], href: 'https://example.com/library',
  verification_notes: 'MANAGER-ONLY VERIFICATION NOTE', verified_by: 'PRIVATE-ACCOUNT-ID' }];
const id = candidates[0].id;
const answer = { decision: 'match', question: null, matches: [{ id, reason: 'Searches books and e-books.' }] };
const completion = (value, extra = {}) => new Response(JSON.stringify({ candidates: [{
  finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(value) }] }, ...extra
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

test('US10 Gemini receives bounded candidate IDs and conversation, but no access links, verification metadata or API key in the prompt', async () => {
  let seen;
  const previousMessages = [{ role: 'user', text: 'I need resources.' }, { role: 'assistant', text: 'What resources?' }];
  const result = await requestSolutionCheck('online books', { candidates, previousMessages,
    apiKey: 'unit-test-private-key', model: 'gemini-3.5-flash-lite', fetchImpl: async (url, init) => {
      seen = { url, init, body: JSON.parse(init.body) };
      return completion(answer);
    }
  });
  assert.deepEqual(result, answer);
  assert.equal(seen.url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent');
  assert.equal(seen.init.headers['x-goog-api-key'], 'unit-test-private-key');
  assert.equal(seen.init.headers.Authorization, undefined);
  assert.equal(seen.url.includes('unit-test-private-key'), false);
  assert.equal(seen.body.generationConfig.maxOutputTokens, 1024);
  assert.equal(seen.body.generationConfig.candidateCount, 1);
  assert.equal(seen.body.generationConfig.responseMimeType, 'application/json');
  assert.equal(seen.body.generationConfig.thinkingConfig.thinkingLevel, 'MINIMAL');
  assert.equal(seen.body.tools, undefined);
  assert.ok(seen.init.signal instanceof AbortSignal);
  const prompt = JSON.stringify([seen.body.systemInstruction, seen.body.contents]);
  for (const secret of ['unit-test-private-key', 'MANAGER-ONLY VERIFICATION NOTE', 'PRIVATE-ACCOUNT-ID', candidates[0].href]) assert.equal(prompt.includes(secret), false);
  assert.deepEqual(JSON.parse(seen.body.contents[0].parts[0].text).previousMessages, previousMessages);
  assert.deepEqual(seen.body.generationConfig.responseJsonSchema.properties.matches.items.properties.id.enum, [id]);
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
    async () => { throw new Error('API-SECRET network failure'); },
    async () => { throw new DOMException('API-SECRET timeout', 'TimeoutError'); },
    async () => new Response('not JSON', { status: 200 }),
    async () => completion({ decision: 'invalid', matches: [] }),
    async () => completion(answer, { finishReason: 'SAFETY' }),
    async () => completion(answer, { finishReason: 'MAX_TOKENS' }),
    async () => new Response(JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' } }), { status: 200 }),
    async () => completion(answer, { finishReason: undefined }),
    async () => completion(answer, { content: { parts: [{ functionCall: { name: 'doSomething' } }] } })
  ];
  for (const fetchImpl of failures) {
    await assert.rejects(() => requestSolutionCheck('books', { candidates, apiKey: 'API-SECRET', fetchImpl }),
      (error) => error.status === 502 && !error.message.includes('API-SECRET'));
  }
});

test('US10 exhausted Gemini quota fails once without retrying or falling back to another model/provider', async () => {
  const urls = [];
  await assert.rejects(() => requestSolutionCheck('books', {
    candidates, apiKey: 'PRIVATE-GEMINI-KEY', fetchImpl: async (url) => {
      urls.push(url);
      return new Response('PRIVATE-GEMINI-KEY quota response', { status: 429 });
    }
  }), (error) => error.status === 503 && error.code === 'SOLUTION_CHECK_UNAVAILABLE' && !error.message.includes('PRIVATE-GEMINI-KEY'));
  assert.deepEqual(urls, ['https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent']);
});

test('US10 rejects unapproved model names before contacting any provider', async () => {
  let calls = 0;
  for (const model of ['gemini-3.1-pro-preview', 'gpt-4o-mini', 'https://evil.example/model', 'gemini-unknown']) {
    await assert.rejects(() => requestSolutionCheck('books', { candidates, apiKey: 'test-key', model,
      fetchImpl: async () => { calls++; return completion(answer); }
    }), (error) => error.status === 503);
  }
  assert.equal(calls, 0);
});

test('US10 does not use an existing OpenAI key when Gemini is unconfigured', async () => {
  const oldGemini = process.env.GEMINI_API_KEY;
  const oldOpenAI = process.env.OPENAI_API_KEY;
  let calls = 0;
  try {
    delete process.env.GEMINI_API_KEY;
    process.env.OPENAI_API_KEY = 'FAKE-OLD-OPENAI-KEY';
    await assert.rejects(() => requestSolutionCheck('books', { candidates,
      fetchImpl: async () => { calls++; return completion(answer); }
    }), (error) => error.status === 503);
    assert.equal(calls, 0);
  } finally {
    if (oldGemini === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldGemini;
    if (oldOpenAI === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldOpenAI;
  }
});

test('US10 ignores Gemini thought parts and reads only the final structured text', async () => {
  const result = await requestSolutionCheck('books', { candidates, apiKey: 'test-key',
    model: 'gemini-3.1-flash-lite', fetchImpl: async () => completion(answer, {
      content: { parts: [{ thought: true, text: 'Internal provider reasoning.' }, { text: JSON.stringify(answer) }] }
    })
  });
  assert.deepEqual(result, answer);
});

test('US10 private free-tier adapter makes no provider request in production mode', async () => {
  const oldMode = process.env.NODE_ENV;
  let calls = 0;
  try {
    process.env.NODE_ENV = 'production';
    await assert.rejects(() => requestSolutionCheck('books', { candidates, apiKey: 'test-key',
      fetchImpl: async () => { calls++; return completion(answer); }
    }), (error) => error.status === 503);
    assert.equal(calls, 0);
  } finally {
    if (oldMode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oldMode;
  }
});
