import express from 'express';
import { requireRole } from '../middleware/requireRole.js';
import { findBenefit, insertBenefit, listBenefits, replaceBenefit } from './queries.js';
import { uuidPattern, validateBenefit } from './validation.js';

function benefitResponse(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    project: row.project_title,
    category: row.category,
    description: row.description,
    measurement: row.measurement,
    estimated: Number(row.estimated),
    actual: Number(row.actual),
    unit: row.unit,
    date: row.date,
    notes: row.notes ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function notFound(res) {
  return res.status(404).json({ code: 'NOT_FOUND', message: 'Benefit or project not found.' });
}

function invalid(res, fields) {
  return res.status(400).json({
    code: 'VALIDATION_ERROR',
    message: 'Check the benefit fields.',
    fields
  });
}

export function benefitRoutes(pool) {
  const router = express.Router();
  const read = requireRole('manager', 'team');
  const write = requireRole('manager');
  const json = express.json({ limit: '64kb' });

  router.get('/benefits', read, async (req, res) => {
    const { projectId } = req.query;
    if (projectId !== undefined && (typeof projectId !== 'string' || !uuidPattern.test(projectId))) {
      return invalid(res, { projectId: 'Choose a valid project.' });
    }
    return res.json((await listBenefits(pool, projectId)).map(benefitResponse));
  });

  router.get('/benefits/:id', read, async (req, res) => {
    const { id } = req.params;
    const row = uuidPattern.test(id) ? await findBenefit(pool, id) : undefined;
    return row ? res.json(benefitResponse(row)) : notFound(res);
  });

  router.post('/benefits', write, json, async (req, res) => {
    const { data, fields } = validateBenefit(req.body);
    if (Object.keys(fields).length) return invalid(res, fields);
    const id = await insertBenefit(pool, req.user.id, data);
    if (!id) return notFound(res);
    return res.location(`/api/v1/benefits/${id}`).status(201).json(benefitResponse(await findBenefit(pool, id)));
  });

  router.put('/benefits/:id', write, json, async (req, res) => {
    const { id } = req.params;
    if (!uuidPattern.test(id)) return notFound(res);
    const { data, fields } = validateBenefit(req.body);
    if (Object.keys(fields).length) return invalid(res, fields);
    if (!await replaceBenefit(pool, id, req.user.id, data)) return notFound(res);
    return res.json(benefitResponse(await findBenefit(pool, id)));
  });

  return router;
}
