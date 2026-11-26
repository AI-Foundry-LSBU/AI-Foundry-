import express from 'express';
import { assessOpportunity, createOpportunity, decideOpportunity, getOpportunity, getOpportunityHistory, listAllOpportunities, listMyOpportunities, listReviews, removeOpportunity, saveOpportunitySavings, suggestOpportunityBenefit } from './handlers.js';

export function opportunityRoutes(pool, options = {}) {
  const router = express.Router();
  router.post('/opportunities', express.json({ limit: '64kb' }), createOpportunity(pool, options));
  router.get('/opportunities', listAllOpportunities(pool));
  router.put('/opportunities/:id/assessment', express.json({ limit: '64kb' }), assessOpportunity(pool));
  router.put('/opportunities/:id/stated-savings', express.json({ limit: '64kb' }), saveOpportunitySavings(pool));
  router.post('/opportunities/:id/decision', express.json({ limit: '64kb' }), decideOpportunity(pool));
  router.post('/opportunities/:id/benefit-suggestion', suggestOpportunityBenefit(pool, options));
  router.get('/me/opportunities', listMyOpportunities(pool));
  router.get('/benefit-reviews', listReviews(pool));
  router.get('/opportunities/:id/history', getOpportunityHistory(pool));
  router.get('/opportunities/:id', getOpportunity(pool, options));
  router.delete('/opportunities/:id', removeOpportunity(pool));
  return router;
}
