import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { requireRole } from '../middleware/requireRole.js';
import { normaliseSolutionCheck, requestSolutionCheck } from './check.js';
import { findPublishedSolutions, publicSolution, searchSolutions } from './queries.js';

const noneMessage = 'No suitable verified solution was found in the checked catalogue entries. You can submit an opportunity.';
const unavailable = {
  code: 'SOLUTION_CHECK_UNAVAILABLE', decision: 'unavailable', question: null, matches: [], canSubmit: true,
  message: 'Existing solutions could not be checked. You can still submit an opportunity.'
};

function validateCheck(body) {
  const fields = {};
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { fields: { body: 'Send a JSON object.' } };
  if (Object.keys(body).some((key) => !['text', 'previousMessages'].includes(key))) fields.body = 'Send only text and previousMessages.';
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text || [...text].length > 800 || text.includes('\0')) fields.text = 'Describe the problem in 1 to 800 characters.';
  const previousMessages = body.previousMessages === undefined ? [] : body.previousMessages;
  if (!Array.isArray(previousMessages) || previousMessages.length > 8 || previousMessages.some((entry) =>
    !entry || typeof entry !== 'object' || Array.isArray(entry) ||
    Object.keys(entry).some((key) => !['role', 'text'].includes(key)) ||
    !['user', 'assistant'].includes(entry.role) || typeof entry.text !== 'string' ||
    !entry.text.trim() || [...entry.text].length > 800 || entry.text.includes('\0')
  )) fields.previousMessages = 'Provide up to eight user/assistant messages of 1 to 800 characters.';
  return { fields, text, previousMessages };
}

export function solutionRoutes(pool, options = {}) {
  const router = express.Router();
  const check = options.checkSolutions ?? requestSolutionCheck;
  const limiter = rateLimit({
    windowMs: 5 * 60 * 1000, limit: options.solutionCheckLimit ?? 20,
    keyGenerator: (req) => req.user.id, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { ...unavailable, code: 'TOO_MANY_CHECKS', message: 'Too many solution checks. Try again later, or submit an opportunity now.' }
  });
  router.post('/solutions/check', requireRole('staff', 'manager', 'team'), limiter, express.json({ limit: '32kb' }), async (req, res) => {
    const { fields, text, previousMessages } = validateCheck(req.body);
    if (Object.keys(fields).length) return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Check the conversation fields.', fields });
    const role = req.user.role;
    try {
      const query = [...previousMessages.filter((entry) => entry.role === 'user').map((entry) => entry.text), text].join(' ');
      let { rows: candidates } = await searchSolutions(pool, { role, q: query, limit: 8 });
      // A bounded fallback set permits semantic checks and clarification when
      // the user used different vocabulary. It obeys exactly the same ACL.
      if (!candidates.length) ({ rows: candidates } = await searchSolutions(pool, { role, limit: 8 }));
      if (!candidates.length) return res.json({ decision: 'none', question: null, matches: [], canSubmit: true, message: noneMessage });
      const result = normaliseSolutionCheck(await check(text, { candidates, previousMessages }), candidates);
      if (!result) return res.status(502).json({ ...unavailable, code: 'SOLUTION_CHECK_FAILED' });
      // A manager might withdraw/change a solution while the provider is busy.
      // Recheck publication, ACL and the content version before returning cards.
      const current = await findPublishedSolutions(pool, result.matches.map((entry) => entry.id), role);
      const snapshots = new Map(candidates.map((entry) => [entry.id, entry.content_version]));
      const allowed = new Map(current.filter((entry) => snapshots.get(entry.id) === entry.content_version).map((entry) => [entry.id, entry]));
      const matches = result.matches.flatMap((entry) => allowed.has(entry.id)
        ? [{ ...publicSolution(allowed.get(entry.id)), reason: entry.reason }] : []);
      const decision = result.decision === 'match' && !matches.length ? 'none' : result.decision;
      return res.json({ decision, question: result.question, matches, canSubmit: true,
        message: decision === 'clarify' ? result.question : decision === 'match'
          ? 'These verified catalogue entries may help. Check their details, or submit anyway.' : noneMessage });
    } catch (error) {
      // Do not forward provider errors, response bodies, keys or hidden records.
      return res.status(error.status === 503 ? 503 : 502).json({ ...unavailable,
        code: error.status === 503 ? 'SOLUTION_CHECK_UNAVAILABLE' : 'SOLUTION_CHECK_FAILED' });
    }
  });
  return router;
}
