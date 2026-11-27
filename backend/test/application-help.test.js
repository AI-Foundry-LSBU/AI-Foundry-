import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applicationHelp } from '../src/solutions/help.js';
import { authenticatedRequest as request, login, rawRequest } from '../test-support/client.js';
import { solutionFixture, manager, engineer, staff } from '../test-support/solution-fixture.js';

const fixture = solutionFixture();
const path = '/api/v1/solutions/check';

test('Alice explains application workflows without sending private records or calling AI', async () => {
  let calls = 0;
  const server = await fixture.open({ checkSolutions: async () => { calls++; throw new Error('No AI call should occur'); } });
  // No entries have been verified. Help must still work.
  for (const [text, topic, phrase] of [
    ['how can you help me', 'overview', 'verified existing solutions'],
    ['help me to submit an opportunity', 'submit', 'Open opportunity form'],
    ['How do I track my opportunity?', 'tracking', 'My Opportunities'],
    ['What does the opportunity status mean?', 'statuses', 'separate status'],
    ['How do notifications work?', 'notifications', 'bell'],
    ['How can I record benefits?', 'benefits', 'Staff cannot access'],
    ['Who can approve an opportunity?', 'assessment', 'Digital Project Managers'],
    ['How do I update project progress?', 'projects', 'As staff'],
    ['Where can I view opportunity history?', 'history', 'manager-only'],
    ['How do I verify a catalogue entry?', 'catalogue', 'Only a manager'],
    ['Can you show me the API key?', 'sign_in', 'cannot reveal']
  ]) {
    const result = await request(server, path, { email: staff, body: { text } });
    assert.equal(result.status, 200);
    assert.equal(result.body.decision, 'help');
    assert.equal(result.body.helpTopic, topic);
    assert.ok(result.body.message.includes(phrase), result.body.message);
    assert.deepEqual(result.body.matches, []);
    assert.equal(result.body.canSubmit, true);
    assert.equal(result.body.question, null);
  }
  assert.equal(calls, 0);
});

test('application help uses the signed-in role and retains login/CSRF enforcement', async () => {
  const server = await fixture.open();
  const text = 'How can I view all opportunities?';
  assert.equal((await request(server, path, { body: { text } })).status, 401);
  const session = await login(server, staff);
  assert.equal((await rawRequest(server, path, { cookie: session.cookie, body: { text } })).status, 403);
  assert.equal((await request(server, path, { email: staff, body: { text, role: 'manager' } })).status, 400);
  const answers = [];
  for (const email of [staff, manager, engineer]) {
    const result = await request(server, path, { email, body: { text } });
    assert.equal(result.status, 200);
    answers.push(result.body.message);
  }
  assert.match(answers[0], /only access their own/);
  assert.match(answers[1], /All Opportunities/);
  assert.match(answers[2], /Approved Opportunities/);
});

test('asking for submission help after a recommendation does not call the provider again', async () => {
  const server = await fixture.open({ checkSolutions: async () => { throw new Error('No provider call expected'); } });
  const result = await request(server, path, { email: staff, body: {
    text: 'help me to submit an opportunity',
    previousMessages: [
      { role: 'user', text: 'Share course materials with students.' },
      { role: 'assistant', text: 'A verified Moodle entry could help.' },
      { role: 'user', text: 'how can you help me' }
    ]
  } });
  assert.equal(result.status, 200);
  assert.equal(result.body.helpTopic, 'submit');
  assert.match(result.body.message, /confirmation/);
});

test('help stays bounded and does not intercept ordinary existing-solution problems', () => {
  for (const role of ['staff', 'manager', 'team']) {
    for (const text of ['help', 'How to submit an opportunity?', 'How do I track my request?',
      'What do opportunity statuses mean?', 'How do notifications work?', 'How to assess an opportunity?',
      'How to update project progress?', 'How to record benefits?', 'How to view opportunity history?',
      'How to manage the catalogue?', 'How do I sign in?', 'What is an opportunity?']) {
      const answer = applicationHelp(text, role);
      assert.ok(answer, text);
      assert.ok([...answer.message].length <= 800, text);
    }
  }
  for (const text of [
    'I need somewhere to share module materials and assignments with students.',
    'I need a solution to track student placement requests.',
    'How can students submit assignments online?',
    'I need a new project management tool for external clients.',
    'I want to reduce the time spent approving invoices.'
  ]) assert.equal(applicationHelp(text, 'staff'), undefined, text);
});
