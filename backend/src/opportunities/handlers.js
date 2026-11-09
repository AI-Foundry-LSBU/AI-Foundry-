import { deleteOpportunity, findOpportunity, findUserOpportunities, insertOpportunity } from './queries.js';
import { validateListQuery, validateSubmission } from './validation.js';

const uuidPattern = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

function opportunityResponse(row, submitterName) {
  return {
    id: row.id,
    title: row.title,
    department: row.department,
    problemDescription: row.problem_description,
    proposedImprovement: row.proposed_improvement,
    expectedBenefits: row.expected_benefits ?? undefined,
    status: row.status,
    source: row.source,
    hackathonName: row.hackathon_name ?? undefined,
    submittedBy: { id: row.submitted_by, name: submitterName },
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at
  };
}

function invalidRequest(res, fields) {
  return res.status(400).json({
    code: 'VALIDATION_ERROR',
    message: 'Some fields are missing or invalid.',
    fields
  });
}

function forbidden(res) {
  return res.status(403).json({
    code: 'FORBIDDEN',
    message: 'You do not have permission to do that.'
  });
}

export function createOpportunity(pool) {
  return async (req, res) => {
    const { data, fields } = validateSubmission(req.body);
    if (Object.keys(fields).length) return invalidRequest(res, fields);

    const requiredRole = data.source === 'hackathon' ? 'team' : 'staff';
    if (req.user.role !== requiredRole) return forbidden(res);

    const row = await insertOpportunity(pool, req.user.id, data);
    return res.location(`/api/v1/opportunities/${row.id}`)
      .status(201).json(opportunityResponse(row, req.user.name));
  };
}

export function listMyOpportunities(pool) {
  return async (req, res) => {
    const { data, fields } = validateListQuery(req.query);
    if (Object.keys(fields).length) return invalidRequest(res, fields);

    const { rows, total } = await findUserOpportunities(pool, req.user.id, data);
    const items = rows.map((row) => ({
      id: row.id,
      title: row.title,
      department: row.department,
      status: row.status,
      priority: row.priority ?? undefined,
      category: row.category ?? undefined,
      submittedAt: row.submitted_at
    }));

    return res.json({ items, page: data.page, pageSize: data.pageSize, total });
  };
}

export function getOpportunity(pool) {
  return async (req, res) => {
    const { id } = req.params;
    const row = uuidPattern.test(id) ? await findOpportunity(pool, id) : undefined;
    if (!row) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Opportunity not found.' });
    }

    if (req.user.role === 'staff' && row.submitted_by !== req.user.id) {
      return forbidden(res);
    }

    return res.json(opportunityResponse(row, row.submitter_name));
  };
}

export function removeOpportunity(pool) {
  return async (req, res) => {
    const { id } = req.params;
    const row = uuidPattern.test(id) ? await findOpportunity(pool, id) : undefined;
    if (!row) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Opportunity not found.' });
    }
    if (row.submitted_by !== req.user.id) return forbidden(res);

    await deleteOpportunity(pool, id, req.user.id);
    return res.status(204).end();
  };
}
