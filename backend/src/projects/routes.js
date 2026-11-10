import express from 'express';
import { createProject, findProject, listProjects, updateProject } from './queries.js';

const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const statuses = ['not_started', 'in_progress', 'testing', 'completed'];

function projectResponse(row) {
  return {
    id: row.id,
    opportunityId: row.opportunity_id,
    title: row.title,
    department: row.department,
    description: row.description,
    priority: row.priority,
    status: row.status,
    progress: row.progress,
    startDate: row.start_date,
    targetDate: row.target_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    notes: row.notes
  };
}

function notFound(res) {
  return res.status(404).json({ code: 'NOT_FOUND', message: 'Project not found.' });
}

function invalid(res, fields) {
  return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Check the project fields.', fields });
}

function canAccess(...roles) {
  return (req, res, next) => {
    if (roles.includes(req.user.role)) return next();
    return res.status(403).json({ code: 'FORBIDDEN', message: 'You do not have permission to do that.' });
  };
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function projectRoutes(pool) {
  const router = express.Router();
  const json = express.json({ limit: '64kb' });
  const delivery = canAccess('manager', 'team');

  router.get('/projects', delivery, async (req, res) => {
    res.json((await listProjects(pool)).map(projectResponse));
  });

  router.post('/projects', canAccess('manager'), json, async (req, res) => {
    if (!req.body || Array.isArray(req.body)) return invalid(res, { body: 'Send a JSON object.' });
    const { opportunityId, startDate, targetDate } = req.body;
    const fields = {};
    if (typeof opportunityId !== 'string' || !uuid.test(opportunityId)) fields.opportunityId = 'Choose a valid opportunity.';
    if (startDate !== undefined && !validDate(startDate)) fields.startDate = 'Enter a valid start date.';
    if (targetDate !== undefined && !validDate(targetDate)) fields.targetDate = 'Enter a valid target date.';
    if (startDate && targetDate && !fields.startDate && !fields.targetDate && targetDate < startDate) {
      fields.targetDate = 'Choose a target date on or after the start date.';
    }
    if (Object.keys(fields).length) return invalid(res, fields);

    const id = await createProject(pool, req.user.id, { opportunityId, startDate, targetDate });
    if (!id) {
      const { rowCount } = await pool.query('SELECT id FROM opportunities WHERE id = $1', [opportunityId]);
      if (!rowCount) return res.status(404).json({ code: 'NOT_FOUND', message: 'Opportunity not found.' });
      return res.status(409).json({
        code: 'PROJECT_UNAVAILABLE',
        message: 'An approved opportunity can be moved to Project Delivery only once.'
      });
    }
    return res.location(`/api/v1/projects/${id}`).status(201).json(projectResponse(await findProject(pool, id)));
  });

  router.get('/projects/:id', delivery, async (req, res) => {
    const { id } = req.params;
    const project = uuid.test(id) ? await findProject(pool, id) : undefined;
    return project ? res.json(projectResponse(project)) : notFound(res);
  });

  router.patch('/projects/:id', delivery, json, async (req, res) => {
    const { id } = req.params;
    if (!uuid.test(id)) return notFound(res);
    if (!req.body || Array.isArray(req.body)) return invalid(res, { body: 'Send a JSON object.' });
    const { status, progress, note } = req.body;
    const fields = {};
    if (status === undefined && progress === undefined && note === undefined) {
      fields.body = 'Provide a status, progress estimate or note.';
    }
    if (status !== undefined && !statuses.includes(status)) fields.status = 'Choose a valid delivery status.';
    if (progress !== undefined && (!Number.isInteger(progress) || progress < 0 || progress > 100)) {
      fields.progress = 'Enter a whole number from 0 to 100.';
    }
    const text = typeof note === 'string' ? note.trim() : '';
    if (note !== undefined && (!text || text.includes('\0') || [...text].length > 2000)) {
      fields.note = 'Enter a note of 1 to 2000 characters without null characters.';
    }
    if (Object.keys(fields).length) return invalid(res, fields);

    const updated = await updateProject(pool, id, req.user.id, { status, progress, note: text || undefined });
    return updated ? res.json(projectResponse(await findProject(pool, id))) : notFound(res);
  });

  return router;
}
