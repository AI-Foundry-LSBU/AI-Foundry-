import { requestBenefitSuggestion } from '../benefits/suggest.js';
import { notifySubmitter } from '../notifications/queries.js';
import { normaliseAssessment } from '../benefits/review.js';
import { lsbuContextVersion } from '../benefits/university.js';
import { benefitReviewContext, deleteOpportunity, findOpportunities, findOpportunity, findOpportunityHistory, insertOpportunity, listBenefitReviews, saveAssessment, saveBenefitReview, saveDecision, saveReviewAssessment } from './queries.js';
import { validateAssessment, validateDecision, validateListQuery, validateOpportunityFilters, validateSubmission } from './validation.js';
import { canReadOpportunity } from '../auth/permissions.js';

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
    deliveryStatus: row.delivery_status ?? undefined,
    priority: row.priority ?? undefined,
    category: row.category ?? undefined,
    source: row.source,
    hackathonName: row.hackathon_name ?? undefined,
    submittedBy: { id: row.submitted_by, name: submitterName },
    submittedAt: row.submitted_at,
    projectId: row.project_id ?? undefined,
    assignee: row.assignee_id ? { id: row.assignee_id, name: row.assignee_name } : undefined,
    benefitReview: row.review_recommendation ? {
      recommendation: row.review_recommendation,
      summary: row.review_summary,
      reason: row.review_reason,
      similarTitle: row.review_similar_title ?? undefined,
      benefits: Array.isArray(row.review_benefits) ? row.review_benefits : []
    } : undefined,
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

async function generateBenefitReview(pool, row, reviewBenefit) {
  const context = await benefitReviewContext(pool, row.id);
  const review = await reviewBenefit({
    title: row.title,
    department: row.department,
    problemDescription: row.problem_description,
    proposedImprovement: row.proposed_improvement,
    expectedBenefits: row.expected_benefits ?? ''
  }, context);
  if (review.similarTitle && !context.existingOpportunityTitles.includes(review.similarTitle)) {
    review.similarTitle = null;
  }
  return review;
}

async function attachBenefitReview(pool, row, reviewBenefit, actor) {
  if (!row || !reviewBenefit) return row;
  let current = row;
  const reviewIsCurrent = current.review_recommendation
    && (current.review_context_version ?? 0) >= lsbuContextVersion;
  if (!reviewIsCurrent) {
    try {
      const review = await generateBenefitReview(pool, current, reviewBenefit);
      await saveBenefitReview(pool, current.id, review);
      current = await findOpportunity(pool, current.id);
    } catch (error) {
      console.error('Benefit review failed:', error.code ?? error.name);
    }
  }
  if (actor?.role !== 'manager' || current.assessment || current.status !== 'submitted') return current;

  let assessment = normaliseAssessment(current.review_assessment);
  if (!assessment) {
    try {
      const review = await generateBenefitReview(pool, current, reviewBenefit);
      assessment = review.assessment;
      if (assessment) await saveReviewAssessment(pool, current.id, assessment);
    } catch (error) {
      console.error('Assessment failed:', error.code ?? error.name);
    }
  }
  if (!assessment) return current;

  const saved = await saveAssessment(pool, current.id, actor.id, assessment);
  if (saved?.previous_status === 'submitted' && saved.status === 'in_assessment') {
    await notifySubmitter(pool, { opportunityId: current.id, actorId: actor.id, kind: 'under_review' });
  }
  return saved ? await findOpportunity(pool, current.id) : current;
}

export function createOpportunity(pool, options = {}) {
  return async (req, res) => {
    const { data, fields } = validateSubmission(req.body);
    if (Object.keys(fields).length) return invalidRequest(res, fields);

    const requiredRole = data.source === 'hackathon' ? 'team' : 'staff';
    if (req.user.role !== requiredRole) return forbidden(res);

    const created = await insertOpportunity(pool, req.user.id, data);
    const row = await attachBenefitReview(pool, created, options.reviewBenefit);
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
    deliveryStatus: row.delivery_status ?? undefined,
    priority: row.priority ?? undefined,
    category: row.category ?? undefined,
    submittedAt: row.submitted_at,
    projectId: row.project_id ?? undefined,
    assignee: row.assignee_id ? { id: row.assignee_id, name: row.assignee_name } : undefined,
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

    return sendOpportunityPage(pool, res, {
      ...data, engineerId: req.user.role === 'team' ? req.user.id : undefined
    }, true);
  };
}

export function listReviews(pool) {
  return async (req, res) => {
    if (req.user.role !== 'manager' && req.user.role !== 'team') return forbidden(res);
    const rows = await listBenefitReviews(pool);
    return res.json(rows.map((row) => ({
      opportunityId: row.id,
      title: row.title,
      department: row.department,
      recommendation: row.recommendation,
      summary: row.summary,
      reason: row.reason,
      similarTitle: row.similar_title ?? undefined,
      benefits: Array.isArray(row.potential_benefits) ? row.potential_benefits : []
    })));
  };
}

export function getOpportunity(pool, options = {}) {
  return async (req, res) => {
    const { id } = req.params;
    let row = uuidPattern.test(id) ? await findOpportunity(pool, id) : undefined;
    if (!row) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Opportunity not found.' });
    }

    if (!canReadOpportunity(req.user, row)) {
      return forbidden(res);
    }
    if (req.user.role === 'manager') {
      row = await attachBenefitReview(pool, row, options.reviewBenefit, req.user);
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
    if (row.previous_status === 'submitted' && row.status === 'in_assessment') {
      await notifySubmitter(pool, { opportunityId: row.id, actorId: req.user.id, kind: 'under_review' });
    }
    return res.json(opportunityResponse(row, row.submitter_name));
  };
}

export function getOpportunityHistory(pool) {
  return async (req, res) => {
    if (req.user.role !== 'manager') return forbidden(res);
    const { id } = req.params;
    const history = uuidPattern.test(id) ? await findOpportunityHistory(pool, id) : undefined;
    if (!history) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Opportunity not found.' });
    }
    return res.json({
      opportunityId: history.opportunityId,
      items: history.rows.map((row) => ({
        id: row.id,
        eventType: row.event_type,
        statusType: row.event_type.startsWith('delivery_') ? 'delivery' : 'opportunity',
        fromStatus: row.from_status,
        toStatus: row.to_status,
        actor: { id: row.actor_id, name: row.actor_name },
        reason: row.reason,
        occurredAt: row.occurred_at,
        source: row.source
      }))
    });
  };
}

export function decideOpportunity(pool) {
  return async (req, res) => {
    if (req.user.role !== 'manager') return forbidden(res);
    const { data, fields } = validateDecision(req.body);
    if (Object.keys(fields).length) return invalidRequest(res, fields);

    const { id } = req.params;
    const row = uuidPattern.test(id) ? await saveDecision(pool, id, req.user.id, data) : undefined;
    if (row) {
      await notifySubmitter(pool, { opportunityId: row.id, actorId: req.user.id, kind: data.decision });
      return res.json(opportunityResponse(row, row.submitter_name));
    }

    if (!uuidPattern.test(id) || !await findOpportunity(pool, id)) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Opportunity not found.' });
    }
    return res.status(409).json({
      code: 'INVALID_STATUS',
      message: 'An opportunity must be under review before you can record a decision.'
    });
  };
}

export function suggestOpportunityBenefit(pool, options = {}) {
  const suggest = options.suggestBenefit ?? requestBenefitSuggestion;
  return async (req, res, next) => {
    if (req.user.role !== 'manager') return forbidden(res);
    const { id } = req.params;
    const row = uuidPattern.test(id) ? await findOpportunity(pool, id) : undefined;
    if (!row) return res.status(404).json({ code: 'NOT_FOUND', message: 'Opportunity not found.' });

    try {
      return res.json(await suggest({
        title: row.title,
        department: row.department,
        problemDescription: row.problem_description,
        proposedImprovement: row.proposed_improvement,
        expectedBenefits: row.expected_benefits ?? ''
      }));
    } catch (error) {
      if (error.status === 502 || error.status === 503) {
        return res.status(error.status).json({ code: error.code, message: error.message });
      }
      return next(error);
    }
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

    try {
      if (!await deleteOpportunity(pool, id, req.user.id)) {
        return res.status(404).json({ code: 'NOT_FOUND', message: 'Opportunity not found.' });
      }
    } catch (error) {
      if (error.code !== '23503' || error.constraint !== 'projects_opportunity_fk') throw error;
      return res.status(409).json({
        code: 'PROJECT_EXISTS',
        message: 'This opportunity is linked to a delivery project and cannot be deleted.'
      });
    }
    return res.status(204).end();
  };
}
