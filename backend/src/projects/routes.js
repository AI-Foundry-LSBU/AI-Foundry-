import express from 'express';
import { requireRole } from '../middleware/requireRole.js';
import { claimProject, createProject, findProject, listProjects, updateProject } from './queries.js';

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
    notes: row.notes,
    assignee: row.assignee_id ? { id: row.assignee_id, name: row.assignee_name } : null
  };
}

function notFound(res) {
  return res.status(404).json({ code: 'NOT_FOUND', message: 'Project not found.' });
}

function invalid(res, fields) {
  return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Check the project fields.', fields });
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function projectRoutes(pool) {
  const router = express.Router();
  const json = express.json({ limit: '64kb' });
  const delivery = requireRole('manager', 'team');

  router.get('/projects', delivery, async (req, res) => {
    res.json((await listProjects(pool)).map(projectResponse));
  });

  router.post('/projects', requireRole('manager'), json, async (req, res) => {
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

  router.post('/projects/:id/assignment', requireRole('team'), async (req, res) => {
    const { id } = req.params;
    if (!uuid.test(id)) return notFound(res);
    const result = await claimProject(pool, id, req.user.id);
    if (result === 'missing') return notFound(res);
    if (result === 'taken') {
      return res.status(409).json({
        code: 'ASSIGNED',
        message: 'Another engineer is already assigned to this project.'
      });
    }
    return res.json(projectResponse(await findProject(pool, id)));
  });

  router.patch('/projects/:id', delivery, json, async (req, res) => {
    const { id } = req.params;
    if (!uuid.test(id)) return notFound(res);
    if (!req.body || Array.isArray(req.body)) return invalid(res, { body: 'Send a JSON object.' });
    const { status, progress, note, startDate, targetDate } = req.body;
    const fields = {};
    if (status === undefined && progress === undefined && note === undefined && startDate === undefined && targetDate === undefined) {
      fields.body = 'Provide a status, progress estimate, note or planned dates.';
    }
    if (status !== undefined && !statuses.includes(status)) fields.status = 'Choose a valid delivery status.';
    if (progress !== undefined && (!Number.isInteger(progress) || progress < 0 || progress > 100)) {
      fields.progress = 'Enter a whole number from 0 to 100.';
    }
    if (startDate !== undefined && !validDate(startDate)) fields.startDate = 'Enter a valid start date.';
    if (targetDate !== undefined && !validDate(targetDate)) fields.targetDate = 'Enter a valid target date.';
    const text = typeof note === 'string' ? note.trim() : '';
    if (note !== undefined && (!text || text.includes('\0') || [...text].length > 2000)) {
      fields.note = 'Enter a note of 1 to 2000 characters without null characters.';
    }
    if (Object.keys(fields).length) return invalid(res, fields);

    const previous = await pool.query(
      `SELECT p.status, p.opportunity_id, p.start_date::text AS start_date, p.target_date::text AS target_date,
              o.status AS opportunity_status
       FROM projects p
       JOIN opportunities o ON o.id = p.opportunity_id
       WHERE p.id = $1`,
      [id]
    );
    const before = previous.rows[0];
    if (!before) return notFound(res);
    const nextStart = startDate ?? before.start_date;
    const nextTarget = targetDate ?? before.target_date;
    if (nextStart && nextTarget && nextTarget < nextStart) {
      return invalid(res, { targetDate: 'Choose a target date on or after the start date.' });
    }
    if ((startDate !== undefined || targetDate !== undefined) && req.user.role !== 'manager') {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: 'Only a manager can set the planned dates.'
      });
    }
    const decided = ['approved', 'rejected', 'in_progress', 'completed'].includes(before.opportunity_status);
    if (req.user.role === 'manager' && decided && status !== undefined && status !== before.status) {
      return res.status(403).json({
        code: 'DECIDED',
        message: 'After a decision, engineers update progress from In Progress to Completed.'
      });
    }
    if (req.user.role === 'team') {
      const owner = await pool.query('SELECT assigned_to FROM projects WHERE id = $1', [id]);
      if (owner.rows[0]?.assigned_to && owner.rows[0].assigned_to !== req.user.id) {
        return res.status(403).json({
          code: 'ASSIGNED',
          message: 'This project is assigned to another engineer.'
        });
      }
      if (status !== undefined && status !== before.status && !['in_progress', 'testing', 'completed'].includes(status)) {
        return res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: 'Check the project fields.',
          fields: { status: 'Choose In Progress, Testing or Completed.' }
        });
      }
    }
    if (before.status === 'completed' && status !== undefined && status !== 'completed') {
      return res.status(409).json({
        code: 'COMPLETED',
        message: 'A completed project stays completed.'
      });
    }
    const updated = await updateProject(pool, id, req.user.id, {
      status, progress, note: text || undefined, startDate, targetDate
    });
    return updated ? res.json(projectResponse(await findProject(pool, id))) : notFound(res);
  });

  return router;
}
