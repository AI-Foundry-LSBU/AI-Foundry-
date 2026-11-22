import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normaliseBenefitReview } from '../src/benefits/review.js';

test('a benefit review keeps a recommendation the manager can act on', () => {
  assert.deepEqual(normaliseBenefitReview({
    recommendation: 'not_worth_it',
    summary: '  This repeats an existing booking improvement.  ',
    reason: 'A saved opportunity already covers room confirmations.',
    similarTitle: 'Automate booking emails'
  }), {
    recommendation: 'not_worth_it',
    summary: 'This repeats an existing booking improvement.',
    reason: 'A saved opportunity already covers room confirmations.',
    similarTitle: 'Automate booking emails',
    benefits: []
  });
  assert.equal(normaliseBenefitReview({
    recommendation: 'worth_pursuing', summary: 'Clear time saving.', reason: 'Staff currently do this by hand.', similarTitle: null,
    benefits: [{ category: 'efficiency', description: 'Staff time', unit: 'Hours/month', estimated: 4, potential: 4 }]
  }).benefits[0].estimated, 4);
  assert.equal(normaliseBenefitReview({
    recommendation: 'worth_pursuing', summary: 'Clear time saving.', reason: 'Staff currently do this by hand.', similarTitle: null,
    benefits: [{ category: 'service', description: 'Fewer missed classes', unit: 'Cases/month', estimated: null, potential: 3, current: 5, proposed: 2 }]
  }).benefits[0].proposed, 2);
  assert.deepEqual(normaliseBenefitReview({
    recommendation: 'not_worth_it', summary: 'Already covered.', reason: 'A similar request exists.', similarTitle: null,
    benefits: [{ category: 'efficiency', description: 'Invented', unit: 'Hours/month', estimated: 9 }]
  }).benefits, []);
  assert.equal(normaliseBenefitReview({ recommendation: 'maybe', summary: 'Yes', reason: 'Yes', similarTitle: null }), undefined);
  const assessed = normaliseBenefitReview({
    recommendation: 'worth_pursuing',
    summary: 'Clear time saving.',
    reason: 'Staff currently do this by hand.',
    similarTitle: null,
    benefits: [],
    assessment: {
      strategicAlignment: 4,
      benefitPotential: 5,
      complexity: 2,
      resourceRequirements: 2,
      speedToValue: 4,
      category: 'automation',
      priority: 'high',
      notes: '  Small change with a stated time saving.  '
    }
  });
  assert.equal(assessed.assessment.priority, 'high');
  assert.match(normaliseBenefitReview({
    recommendation: 'not_worth_it', summary: 'Already covered.', reason: 'A similar request exists.', similarTitle: null, lsbuTheme: 'technology'
  }).reason, /^This connects to LSBU Technology\./);
  assert.equal(assessed.assessment.notes, 'Small change with a stated time saving.');
  assert.equal(normaliseBenefitReview({
    recommendation: 'worth_pursuing', summary: 'Clear time saving.', reason: 'Staff currently do this by hand.', similarTitle: null,
    assessment: { strategicAlignment: 9, benefitPotential: 5, complexity: 2, resourceRequirements: 2, speedToValue: 4, category: 'automation', priority: 'high', notes: 'Too high.' }
  }).assessment, undefined);
});
