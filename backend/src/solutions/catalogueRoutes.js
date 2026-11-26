import express from 'express';
import { requireRole } from '../middleware/requireRole.js';
import { managedSolution, publicSolution, saveSolution, searchSolutions } from './queries.js';
import { validateCatalogueEntry, validateCatalogueSearch } from './validation.js';

const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const invalid = (res, fields) => res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Check the catalogue fields.', fields });

export function catalogueRoutes(pool) {
  const router = express.Router();
  const manager = requireRole('manager');
  const json = express.json({ limit: '32kb' });

  const list = (management) => async (req, res) => {
    const { data, fields } = validateCatalogueSearch(req.query, management);
    if (Object.keys(fields).length) return invalid(res, fields);
    const { rows, total } = await searchSolutions(pool, { ...data, role: req.user.role, management });
    return res.json({ items: rows.map(management ? managedSolution : publicSolution), total, limit: data.limit });
  };
  router.get('/solutions', requireRole('staff', 'manager', 'team'), list(false));
  router.get('/solutions/catalogue', manager, list(true));
  router.post('/solutions/catalogue', manager, json, async (req, res) => {
    const { data, fields } = validateCatalogueEntry(req.body);
    if (Object.keys(fields).length) return invalid(res, fields);
    const row = await saveSolution(pool, null, req.user.id, data);
    return res.status(201).json(managedSolution(row));
  });
  router.put('/solutions/catalogue/:id', manager, json, async (req, res) => {
    if (!uuid.test(req.params.id)) return res.status(404).json({ code: 'NOT_FOUND', message: 'Catalogue entry not found.' });
    const { data, fields } = validateCatalogueEntry(req.body);
    if (Object.keys(fields).length) return invalid(res, fields);
    const row = await saveSolution(pool, req.params.id, req.user.id, data);
    return row ? res.json(managedSolution(row)) : res.status(404).json({ code: 'NOT_FOUND', message: 'Catalogue entry not found.' });
  });
  return router;
}
