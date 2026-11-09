import express from 'express';
import { assessOpportunity, createOpportunity, decideOpportunity, getOpportunity, listAllOpportunities, listMyOpportunities } from './handlers.js';

export function opportunityRoutes(pool) {
  const router = express.Router();
  router.post('/opportunities', express.json({ limit: '64kb' }), createOpportunity(pool));
  router.get('/opportunities', listAllOpportunities(pool));
  router.put('/opportunities/:id/assessment', express.json({ limit: '64kb' }), assessOpportunity(pool));
  router.post('/opportunities/:id/decision', express.json({ limit: '64kb' }), decideOpportunity(pool));
  router.get('/me/opportunities', listMyOpportunities(pool));
  router.get('/opportunities/:id', getOpportunity(pool));
  return router;
}
