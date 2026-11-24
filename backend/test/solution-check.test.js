import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normaliseSolutionCheck, requestSolutionCheck } from '../src/solutions/check.js';

test('a check keeps only real services and drops a related guess when nothing qualifies', () => {
  assert.deepEqual(normaliseSolutionCheck({
    decision: 'match',
    matches: [{ id: 'library', reason: 'The library already has books and e-books to search.' }]
  }), {
    decision: 'match',
    matches: [{ id: 'library', reason: 'The library already has books and e-books to search.' }]
  });
  assert.deepEqual(normaliseSolutionCheck({
    decision: 'none',
    matches: [{ id: 'mylsbu', reason: 'This is about attendance.' }]
  }), { decision: 'none', matches: [] });
  assert.deepEqual(normaliseSolutionCheck({
    decision: 'match',
    matches: [{ id: 'invented', reason: 'A door scanner.' }]
  }), { decision: 'none', matches: [] });
  assert.equal(normaliseSolutionCheck({ decision: 'maybe', matches: [] }), undefined);
});

test('the OpenAI request uses the server key and does not echo it in a failure', async () => {
  let seen;
  const result = await requestSolutionCheck('where can students find an online book', {
    apiKey: 'test-key',
    model: 'test-model',
    fetchImpl: async (url, init) => {
      seen = { url, init };
      return new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({
          decision: 'match',
          matches: [{ id: 'library', reason: 'Students already search for books in the library.' }]
        }) } }]
      }), { status: 200 });
    }
  });

  assert.equal(seen.url, 'https://api.openai.com/v1/chat/completions');
  assert.equal(seen.init.headers.Authorization, 'Bearer test-key');
  assert.equal(result.matches[0].id, 'library');
  await assert.rejects(
    () => requestSolutionCheck('scan an id', {
      apiKey: 'secret-key',
      fetchImpl: async () => new Response('no', { status: 401 })
    }),
    (error) => error.status === 502 && !error.message.includes('secret-key')
  );
});
