import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cardsFor, greetingMessage, solutionReply } from '../src/data/solutionChat.js';

const card = { id: 'a-dynamic-database-id', name: 'New verified service', description: 'A newly added capability.', reason: 'Matches the workflow.', href: 'https://example.com/new', accessInstructions: null };

test('US10 cards use dynamic server records rather than a hard-coded browser catalogue', () => {
  assert.deepEqual(cardsFor([card, card]), [card]);
  assert.equal(cardsFor([{ ...card, href: null, accessInstructions: 'Ask the service owner.' }])[0].href, null);
  assert.deepEqual(cardsFor([{ ...card, href: 'javascript:alert(1)' }]), []);
  assert.deepEqual(cardsFor([{ ...card, href: 'https://user:password@example.com' }]), []);
  assert.deepEqual(cardsFor([{ id: card.id }]), []);
});

test('US10 specific follow-up and failure/no-match replies preserve the submission route', () => {
  assert.equal(solutionReply({ decision: 'clarify', question: 'Which team does the work?' }).text, 'Which team does the work?');
  assert.equal(solutionReply({ decision: 'none', message: 'You can submit.' }).kind, 'none');
  assert.equal(solutionReply({ decision: 'unavailable', message: 'Continue to the form.' }).kind, 'none');
  assert.deepEqual(solutionReply({ decision: 'match', message: 'Check this service.', matches: [card] }).solutions, [card]);
  assert.match(greetingMessage().text, /submit an opportunity at any time/);
});

test('application help shows a form action only for submission instructions', () => {
  assert.deepEqual(solutionReply({ decision: 'help', helpTopic: 'submit', message: 'Open the form.' }), {
    kind: 'help', text: 'Open the form.', showFormAction: true
  });
  assert.equal(solutionReply({ decision: 'help', helpTopic: 'tracking', message: 'Use My Opportunities.' }).showFormAction, false);
  assert.match(greetingMessage().text, /submit or track/);
});
