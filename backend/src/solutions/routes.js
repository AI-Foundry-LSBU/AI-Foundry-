import express from 'express';
import { requireRole } from '../middleware/requireRole.js';
import { requestSolutionCheck } from './check.js';

export function solutionRoutes(options = {}) {
  const router = express.Router();
  const check = options.checkSolutions ?? requestSolutionCheck;
  const json = express.json({ limit: '16kb' });

  router.post('/solutions/check', requireRole('staff', 'manager', 'team'), json, async (req, res, next) => {
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!text || [...text].length > 800) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Describe the problem in 800 characters or fewer.',
        fields: { text: 'Describe the problem.' }
      });
    }
    try {
      return res.json(await check(text));
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ code: error.code, message: error.message });
      }
      return next(error);
    }
  });

  return router;
}
