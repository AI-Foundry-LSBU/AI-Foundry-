import { findOpportunities, findOpportunity, insertOpportunity, saveAssessment, saveDecision } from './queries.js';
import { validateAssessment, validateDecision, validateListQuery, validateOpportunityFilters, validateSubmission } from './validation.js';

const uuidPattern = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

function assessmentResponse(row) {
  const assessment = row.assessment;
  if (!assessment) return undefined;
  return {
    strategicAlignment: assessment.strategic_alignment,
    benefitPotential: assessment.benefit_potential,
    complexity: assessment.complexity,
    resourceRequirements: assessment.resource_requirements,
    speedToValue: assessment.speed_to_value,
    priority: row.priority,
    category: row.category ?? undefined,
    notes: assessment.notes ?? undefined,
    assessedBy: { id: assessment.assessed_by, name: row.assessor_name },
    assessedAt: assessment.assessed_at
  };
}

function decisionResponse(row) {
  const decision = row.decision;
  if (!decision) return undefined;
  return {
    decision: decision.decision,
    reason: decision.reason ?? undefined,
    decidedBy: { id: decision.decided_by, name: row.decider_name },
    decidedAt: decision.decided_at
  };
}

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
    updatedAt: row.updated_at,
    assessment: assessmentResponse(row),
    decision: decisionResponse(row)
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

async function sendOpportunityPage(pool, res, data, includeSubmitter = false) {
  const { rows, total } = await findOpportunities(pool, data);
  const items = rows.map((row) => ({
    id: row.id,
    title: row.title,
    department: row.department,
    status: row.status,
    priority: row.priority ?? undefined,
    category: row.category ?? undefined,
    submittedAt: row.submitted_at,
    submittedBy: includeSubmitter ? { id: row.submitted_by, name: row.submitter_name } : undefined
  }));

  return res.json({ items, page: data.page, pageSize: data.pageSize, total });
}

export function listMyOpportunities(pool) {
  return async (req, res) => {
    const { data, fields } = validateListQuery(req.query);
    if (Object.keys(fields).length) return invalidRequest(res, fields);

    return sendOpportunityPage(pool, res, { ...data, userId: req.user.id });
  };
}

export function listAllOpportunities(pool) {
  return async (req, res) => {
    if (req.user.role !== 'manager' && req.user.role !== 'team') return forbidden(res);
    const { data, fields } = validateOpportunityFilters(req.query);
    if (Object.keys(fields).length) return invalidRequest(res, fields);

    return sendOpportunityPage(pool, res, data, true);
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

export function assessOpportunity(pool) {
  return async (req, res) => {
    if (req.user.role !== 'manager') return forbidden(res);
    const { data, fields } = validateAssessment(req.body);
    if (Object.keys(fields).length) return invalidRequest(res, fields);

    const { id } = req.params;
    const row = uuidPattern.test(id) ? await saveAssessment(pool, id, req.user.id, data) : undefined;
    if (!row) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Opportunity not found.' });
    }
    return res.json(opportunityResponse(row, row.submitter_name));
  };
}

export function decideOpportunity(pool) {
  return async (req, res) => {
    if (req.user.role !== 'manager') return forbidden(res);
    const { data, fields } = validateDecision(req.body);
    if (Object.keys(fields).length) return invalidRequest(res, fields);

    const { id } = req.params;
    const row = uuidPattern.test(id) ? await saveDecision(pool, id, req.user.id, data) : undefined;
    if (row) return res.json(opportunityResponse(row, row.submitter_name));

    if (!uuidPattern.test(id) || !await findOpportunity(pool, id)) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Opportunity not found.' });
    }
    return res.status(409).json({
      code: 'INVALID_STATUS',
      message: 'An opportunity must be under review before you can record a decision.'
    });
  };
}
