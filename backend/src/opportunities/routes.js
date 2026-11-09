import express from 'express';
import { createOpportunity, getOpportunity, listMyOpportunities, removeOpportunity } from './handlers.js';

export function opportunityRoutes(pool) {
  const router = express.Router();
  router.post('/opportunities', express.json({ limit: '64kb' }), createOpportunity(pool));
  router.get('/me/opportunities', listMyOpportunities(pool));
  router.get('/opportunities/:id', getOpportunity(pool));
  router.delete('/opportunities/:id', removeOpportunity(pool));
  return router;
}
