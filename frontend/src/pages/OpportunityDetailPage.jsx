import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  X
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { categories } from "../data/options";
import { deleteOpportunity, getOpportunity, getOpportunityDisplayStatus, getOpportunityHistory, saveOpportunityAssessment, saveOpportunityDecision } from "../data/opportunitiesApi";
import { useOpportunities } from "../data/useOpportunities";
import { claimDeliveryProject, createDeliveryProject, deliveryStatuses, engineerDeliveryStatuses, updateDeliveryProject } from "../data/projectsApi";
import { BenefitCharts } from "../components/BenefitCharts";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Modal,
  PriorityBadge,
  StatusBadge
} from "../components/ui";

function BenefitReview({ review }) {
  const title = review?.recommendation === "not_worth_it" ? "Not worth pursuing" : review ? "Worth pursuing" : "Benefit review";
  return <Card className="benefit-review">
    <div className="card-header">
      <div>
        <p className="benefit-kicker">Suggestion for London South Bank University</p>
        <h2>{title}</h2>
      </div>
    </div>
    <div className="benefit-review-body">
      <p className="benefit-summary">{review?.summary ?? "A benefit review has not been prepared for this opportunity."}</p>
      {review?.reason && <p>{review.reason}</p>}
      {review?.similarTitle && <p className="benefit-covered">Already covered by: {review.similarTitle}</p>}
      {review && <BenefitCharts review={review} />}
    </div>
  </Card>;
}

const assessmentFields = {
  "Strategic alignment": "strategicAlignment",
  "Benefit potential": "benefitPotential",
  Complexity: "complexity",
  "Resource requirements": "resourceRequirements",
  "Speed to value": "speedToValue",
};

export function OpportunityDetailPage() {
  const { id } = useParams();
  const { role, currentUser, opportunities } = useApp();
  const navigate = useNavigate();
  const sample = opportunities.find((item) => item.id === id);
  const liveRole = role === currentUser.role;
  const isLive = role === "Staff" || (liveRole && (role === "AI Foundry Engineer" || !sample));
  const live = useOpportunities(isLive ? currentUser.email : null, "mine", id);
  const opportunity = isLive ? live.data : sample;
  if (live.loading) return <div role="status"><EmptyState title="Loading opportunity…" /></div>;
  if (live.error && live.error.status !== 404) {
    const forbidden = live.error.status === 403;
    return <div role="alert">
        <EmptyState
          title={forbidden ? "Access restricted" : "Could not load this opportunity"}
          text={live.error.message}
          action={forbidden
            ? <Button onClick={() => navigate("/opportunities")}>Back to opportunities</Button>
            : <Button onClick={live.retry}>Try again</Button>}
        />
      </div>;
  }
  if (!opportunity)
    return <EmptyState
      title="Opportunity not found"
      text="This opportunity may have been removed or the link is incorrect."
      action={<Button onClick={() => navigate("/opportunities")}>
            Back to opportunities
          </Button>}
    />;
  return <OpportunityDetail
    key={`${currentUser.email}:${role}:${id}`}
    initialOpportunity={opportunity}
    isLive={isLive}
  />;
}

function OpportunityDetail({ initialOpportunity, isLive }) {
  const { role, currentUser, projects, assessOpportunity, decideOpportunity, createProject } = useApp();
  const navigate = useNavigate();
  const isStaff = role === "Staff";
  const [savedOpportunity, setSavedOpportunity] = useState(null);
  const opportunity = savedOpportunity ?? initialOpportunity;
  const [priority, setPriority] = useState(
    opportunity?.priority ?? "Not set"
  );
  const [category, setCategory] = useState(
    opportunity?.category === "Uncategorised" ? "" : opportunity?.category ?? ""
  );
  const [ratings, setRatings] = useState(() => Object.fromEntries(
    Object.entries(assessmentFields).map(([label, field]) => [
      label, opportunity.assessment?.[isLive ? field : label] ?? 0,
    ]),
  ));
  const [notes, setNotes] = useState(isLive ? opportunity.assessment?.notes ?? "" : "");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [assessmentComments, setAssessmentComments] = useState(opportunity?.assessmentComments ?? {});
  const [decisionReason, setDecisionReason] = useState(
    opportunity?.decisionReason ?? ""
  );
  const [reasonError, setReasonError] = useState("");
  const [message, setMessage] = useState("");
  const [pendingDecision, setPendingDecision] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const [pipelineError, setPipelineError] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [history, setHistory] = useState({ loading: isLive, items: [], error: null });
  const [historyAttempt, setHistoryAttempt] = useState(0);
  const [deliveryOverride, setDeliveryOverride] = useState(null);
  const [pendingStatus, setPendingStatus] = useState(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [claimedByMe, setClaimedByMe] = useState(false);
  const [projectForm, setProjectForm] = useState({
    startDate: "",
    targetDate: ""
  });
  useEffect(() => {
    if (!isLive || role !== "Digital Project Manager") return undefined;
    const controller = new AbortController();
    getOpportunityHistory(currentUser.email, initialOpportunity.id, controller.signal).then(
      (items) => setHistory({ loading: false, items, error: null }),
      (error) => {
        if (error.name !== "AbortError") setHistory({ loading: false, items: [], error });
      },
    );
    return () => controller.abort();
  }, [isLive, role, currentUser.email, initialOpportunity.id, historyAttempt]);
  const isManager = role === "Digital Project Manager";
  const isEngineer = role === "AI Foundry Engineer";
  const assignedToMe = claimedByMe || opportunity.assignee?.id === currentUser.id;
  const canDecide = !isLive || opportunity.status === "Under Review";
  const decisionMade = opportunity.status === "Approved" || opportunity.status === "Rejected";
  const assessmentLocked = isLive && opportunity.status === "Approved";
  const managerCanChangeProgress = isManager && !decisionMade;
  const engineerCanChangeProgress = isEngineer && assignedToMe;
  const assignmentLabel = assignedToMe ? "Assigned to you" : opportunity.assignee ? `Assigned to ${opportunity.assignee.name}` : "Not assigned";
  const project = isLive ? undefined : projects.find((item) => item.opportunityId === opportunity.id);
  const projectId = isLive ? opportunity.projectId : project?.id;
  const plannedDates = Boolean(opportunity.projectStartDate || opportunity.projectTargetDate);
  const isRestricted = isEngineer && opportunity.status !== "Approved";
  if (isRestricted)
    return <EmptyState
      title="Access restricted"
      text="This record is not available for the selected role."
      action={<Button onClick={() => navigate("/dashboard")}>
            Return to dashboard
          </Button>}
    />;
  const deliveryStatus = deliveryOverride ?? opportunity.deliveryStatus ?? initialOpportunity.deliveryStatus;
  const completedDelivery = deliveryStatus === "Completed";
  const changeDeliveryStatus = async (next) => {
    if (!isLive || !projectId || next === deliveryStatus || statusSaving || completedDelivery) return;
    setStatusError("");
    setStatusSaving(true);
    try {
      const updated = await updateDeliveryProject(currentUser.email, projectId, { status: next });
      setDeliveryOverride(updated.status);
      setPendingStatus(null);
      setHistoryAttempt((current) => current + 1);
    } catch (error) {
      setStatusError(error.message);
    } finally {
      setStatusSaving(false);
    }
  };
  const displayStatus = getOpportunityDisplayStatus({ status: opportunity.status, deliveryStatus });
  const deliveryStages = deliveryStatus ? ["In Progress", "Testing", "Completed"] : ["In Progress", "Completed"];
  const rejected = opportunity.status === "Rejected";
  const pending = opportunity.status === "Submitted" || opportunity.status === "Under Review";
  const stages = pending
    ? ["Submitted", "Under Review", "Decision"]
    : rejected
      ? ["Submitted", "Under Review", "Rejected"]
      : ["Submitted", "Under Review", "Approved", ...deliveryStages];
  const currentIndex = stages.indexOf(displayStatus);
  const criterionGuidance = {
    "Strategic alignment": "1 = limited connection to LSBU priorities \xB7 5 = directly advances a key priority",
    "Benefit potential": "1 = limited or uncertain benefit \xB7 5 = substantial, measurable benefit",
    Complexity: "1 = straightforward delivery \xB7 5 = significant technical or organisational complexity",
    "Resource requirements": "1 = minimal resource requirement \xB7 5 = major specialist or team commitment",
    "Speed to value": "1 = long lead time to benefit \xB7 5 = value can be demonstrated quickly"
  };
  const save = async () => {
    if (!isLive) {
      const saved = assessOpportunity(opportunity.id, priority, ratings, assessmentComments, category || "Uncategorised");
      if (saved) setMessage("Assessment saved successfully.");
      return;
    }
    if (saving) return;
    setMessage("");
    setSaveError("");
    if (priority === "Not set" || Object.values(ratings).some((rating) => rating === 0)) {
      setSaveError("Rate all five criteria and select a priority.");
      return;
    }

    const scores = Object.fromEntries(Object.entries(assessmentFields).map(([label, field]) => [field, ratings[label]]));
    setSaving(true);
    try {
      const updated = await saveOpportunityAssessment(currentUser.email, opportunity.id, { ...scores, priority, category, notes });
      setSavedOpportunity(updated);
      setMessage("Assessment saved successfully.");
      setHistoryAttempt((current) => current + 1);
    } catch (error) {
      setSaveError(error.message);
    } finally {
      setSaving(false);
    }
  };
  const openDecision = (decision) => {
    if (decision === "Rejected" && !decisionReason.trim()) {
      setReasonError("Please write a reason.");
      return;
    }
    setReasonError("");
    setSaveError("");
    setPendingDecision(decision);
  };
  const closeDecision = () => {
    if (saving) return;
    setSaveError("");
    setPendingDecision(null);
  };
  const decide = async () => {
    if (!pendingDecision || saving) return;
    if (isLive) {
      setMessage("");
      setSaveError("");
      setSaving(true);
      try {
        const updated = await saveOpportunityDecision(currentUser.email, opportunity.id, {
          decision: pendingDecision,
          reason: decisionReason.trim(),
        });
        setSavedOpportunity(updated);
        setMessage(`Opportunity ${updated.status.toLowerCase()}.`);
        setPendingDecision(null);
        setHistoryAttempt((current) => current + 1);
      } catch (error) {
        setSaveError(error.fields?.reason ?? error.message);
      } finally {
        setSaving(false);
      }
      return;
    }
    assessOpportunity(
      opportunity.id,
      priority,
      ratings,
      assessmentComments,
      category || "Uncategorised"
    );
    const saved = decideOpportunity(
      opportunity.id,
      pendingDecision,
      decisionReason
    );
    if (saved) {
      setMessage(
        pendingDecision === "Approved" ? "Opportunity approved. It can now be moved to Project Delivery." : pendingDecision === "Rejected" ? "Opportunity rejected and retained in the opportunity history." : "Opportunity kept under review."
      );
    }
    setPendingDecision(null);
  };
  const moveToPipeline = async (event) => {
    event.preventDefault();
    if (creatingProject) return;
    if (isLive) {
      setPipelineError("");
      setCreatingProject(true);
      try {
        const dates = {
          ...(projectForm.startDate ? { startDate: projectForm.startDate } : {}),
          ...(projectForm.targetDate ? { targetDate: projectForm.targetDate } : {}),
        };
        let id = projectId;
        let alreadyCreated = Boolean(projectId);
        if (!id) {
          try {
            const created = await createDeliveryProject(currentUser.email, opportunity.id, projectForm);
            id = created.id;
          } catch (error) {
            if (error.status !== 409) throw error;
            const current = await getOpportunity(currentUser.email, opportunity.id);
            id = current.projectId;
            if (!id) throw error;
            alreadyCreated = true;
            setSavedOpportunity(current);
          }
        }
        if (alreadyCreated && Object.keys(dates).length) {
          await updateDeliveryProject(currentUser.email, id, dates);
        }
        navigate(`/projects/${id}`);
      } catch (error) {
        setPipelineError(error.fields?.startDate ?? error.fields?.targetDate ?? error.message);
      } finally {
        setCreatingProject(false);
      }
      return;
    }
    const created = createProject(
      opportunity.id,
      projectForm.startDate,
      projectForm.targetDate
    );
    if (created) {
      setPipelineOpen(false);
      setMessage(`${created.id} created in the Approved column.`);
    }
  };
  return <>
      <button className="back-link" onClick={() => navigate("/opportunities")}>
        <ArrowLeft size={17} /> Back to{" "}
        {isStaff ? "my opportunities" : isEngineer ? "approved opportunities" : "all opportunities"}
      </button>
      <div className="detail-heading">
        <div>
          <div className="detail-kicker">
            <span className="mono">{opportunity.id}</span>
            <StatusBadge status={displayStatus} />
          </div>
          <h1>{opportunity.title}</h1>
          <p>
            Submitted by {opportunity.submittedBy} on{" "}
            {opportunity.submittedDate}
          </p>
        </div>
        <div className="detail-actions">
          {opportunity.priority !== "Not set" && <PriorityBadge priority={opportunity.priority} />}
          {isStaff && !projectId && <Button
            variant="danger"
            onClick={() => {
              setDeleteError("");
              setConfirmDelete(true);
            }}
          >
            Delete
          </Button>}
        </div>
      </div>
      {message && <div className="toast-message">
          <CheckCircle2 size={18} />
          <span>{message}</span>
        </div>}
      <Card
    className={`timeline-card ${opportunity.status === "Rejected" ? "rejected-timeline" : ""}`}
  >
        <div className="card-header">
          <div>
            <h2>Opportunity progress</h2>
            <p>
              {rejected ? "This opportunity was rejected." : "Submitted, reviewed, then delivered."}
            </p>
          </div>
        </div>
        <div className="timeline">
            {stages.map((stage, index) => <div
    className={`timeline-step ${index <= currentIndex ? "complete" : ""} ${index === currentIndex ? "current" : ""} ${stage === "Rejected" ? "rejected" : ""}`}
    key={stage}
  >
                <div>
                  {stage === "Rejected" ? <X size={14} /> : <Check size={14} />}
                </div>
                <span>{stage}</span>
              </div>)}
          </div>
      </Card>
      {isLive && projectId && !isStaff && <Card>
        <div className="card-header">
          <div>
            <h2>Delivery status</h2>
            <p>{assignmentLabel}</p>
          </div>
          <StatusBadge status={deliveryStatus} />
        </div>
        {isEngineer && !assignedToMe && <div className="delivery-status-update">
          {opportunity.assignee
            ? <p>{opportunity.assignee.name} is working on this project.</p>
            : <Button onClick={async () => {
              setStatusError("");
              try {
                await claimDeliveryProject(currentUser.email, projectId);
                setClaimedByMe(true);
              } catch (error) {
                setStatusError(error.message);
              }
            }}>Assign to me</Button>}
          {statusError && <p role="alert" className="error-text">{statusError}</p>}
        </div>}
        {(managerCanChangeProgress || engineerCanChangeProgress) && <div className="delivery-status-update">
          <Field label="Status" helper={engineerCanChangeProgress ? "Move the project from In Progress to Completed." : "You can change progress until you approve or reject."}>
            <select
              aria-label={`Delivery status for ${opportunity.title}`}
              value={deliveryStatus}
              disabled={statusSaving || completedDelivery}
              onChange={(event) => {
                const next = event.target.value;
                if (next !== deliveryStatus) {
                  setStatusError("");
                  setPendingStatus(next);
                }
              }}
            >
              {(engineerCanChangeProgress ? engineerDeliveryStatuses(deliveryStatus) : deliveryStatuses).map((item) => <option key={item}>{item}</option>)}
            </select>
          </Field>
          {statusError && !pendingStatus && <p role="alert" className="error-text">{statusError}</p>}
        </div>}
      </Card>}
      <Card>
        <div className="card-header">
          <div>
            <h2>Opportunity information</h2>
            <p>Information provided with the original submission</p>
          </div>
        </div>
        <div className="meta-grid">
          <div>
            <span>Department</span>
            <strong>{opportunity.department}</strong>
          </div>
          <div>
            <span>Category</span>
            <strong>{opportunity.category}</strong>
          </div>
          <div>
            <span>Submitted by</span>
            <strong>{opportunity.submittedBy}</strong>
          </div>
          <div>
            <span>Submission date</span>
            <strong>{opportunity.submittedDate}</strong>
          </div>
        </div>
        <div className="narrative">
          <span>Problem Description</span>
          <p>{opportunity.problem}</p>
        </div>
        <div className="narrative">
          <span>Suggested Improvement</span>
          <p>{opportunity.improvement}</p>
        </div>
        {opportunity.expectedBenefits && <div className="narrative">
            <span>Expected Benefits</span>
            <p>{opportunity.expectedBenefits}</p>
          </div>}
      </Card>
      {isLive && isManager && <BenefitReview review={opportunity.benefitReview} />}
      <div className={`detail-grid ${isManager ? "management" : ""}`}>
        <div className="detail-content">
          {isLive && isManager && <Card>
            <div className="card-header">
              <div>
                <h2>History</h2>
                <p>Status changes and decisions, oldest first. Previous entries cannot be edited.</p>
              </div>
            </div>
            {history.loading && <p role="status">Loading history…</p>}
            {history.error && <div role="alert">
              <EmptyState title="Could not load history" text={history.error.message} action={<Button onClick={() => setHistoryAttempt((current) => current + 1)}>Try again</Button>} />
            </div>}
            {!history.loading && !history.error && history.items.length === 0 && <p className="activity-empty">No history recorded yet.</p>}
            {history.items.length > 0 && <div className="activity-list">
              {history.items.map((item) => <div className="activity-item" key={item.id}>
                <div className="activity-dot" />
                <div>
                  <strong>{item.summary}</strong>
                  {item.reason && <p className="history-reason">{item.reason}</p>}
                  <span>{item.actor.name} · {new Date(item.createdAt).toLocaleString("en-GB", {
                    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                  })}</span>
                </div>
              </div>)}
            </div>}
          </Card>}
          {(opportunity.decisionStatus || opportunity.decisionReason) && <Card>
              <div className="card-header">
                <div>
                  <h2>AI Foundry decision</h2>
                  <p>Review outcome and feedback from the assessment team</p>
                </div>
                <StatusBadge status={opportunity.decisionStatus ?? opportunity.status} />
              </div>
              {opportunity.decisionReason && <div className="narrative">
                <span>Decision reason</span>
                <p>{opportunity.decisionReason}</p>
              </div>}
            </Card>}
          {!isStaff && (deliveryStatus || project) && <Card>
              <div className="card-header">
                <div>
                  <h2>Project delivery</h2>
                  <p>
                    This approved opportunity is now tracked as a separate
                    delivery project.
                  </p>
                </div>
                <StatusBadge status={deliveryStatus ?? project.status} />
              </div>
              <div className="meta-grid">
                <div>
                  <span>Project reference</span>
                  <strong>{projectId}</strong>
                </div>
                <div>
                  <span>Delivery status</span>
                  <strong>{deliveryStatus ?? project.status}</strong>
                </div>
                {project && <div>
                  <span>Target completion</span>
                  <strong>{project.targetDate}</strong>
                </div>}
                {isEngineer && <div>
                  <Button variant="secondary" onClick={() => navigate(`/projects/${projectId}`)}>
                    View Project
                  </Button>
                </div>}
              </div>
            </Card>}
        </div>
        {isManager && <Card className={`assessment-card${isLive && opportunity.assessment ? " assessment-prepared" : ""}`}>
            <div className="card-header">
              <div>
                <h2>Opportunity Assessment</h2>
                <p>
                  {assessmentLocked
                    ? "This assessment stays as it was when the opportunity was approved."
                    : isLive && opportunity.assessment
                      ? "Prepared automatically. Change any score, then save."
                      : "Rate each criterion independently, then set a manual priority."}
                </p>
              </div>
            </div>
            <div className="rating-list">
              {Object.entries(ratings).map(([criterion, value]) => <div className="assessment-criterion" key={criterion}>
                  <div className="rating-row">
                    <div>
                      <strong>{criterion}</strong>
                      <span>{criterionGuidance[criterion]}</span>
                    </div>
                    <div className="rating-buttons">
                      {[1, 2, 3, 4, 5].map((rating) => <button
    key={rating}
    className={value === rating ? "selected" : ""}
    onClick={() => setRatings((current) => ({
      ...current,
      [criterion]: rating
    }))}
    aria-label={`${criterion}: ${rating} out of 5`}
    aria-pressed={value === rating}
    disabled={saving || assessmentLocked}
  >
                          {rating}
                        </button>)}
                    </div>
                  </div>
                  {!isLive && <textarea
    rows={2}
    value={assessmentComments[criterion] ?? ""}
    onChange={(event) => setAssessmentComments((current) => ({
      ...current,
      [criterion]: event.target.value
    }))}
    placeholder={`Optional comments about ${criterion.toLowerCase()}...`}
  />}
                </div>)}
            </div>
            <Field label="Category">
              <select
    value={category}
    disabled={saving || assessmentLocked}
    onChange={(event) => setCategory(event.target.value)}
  >
                <option value="">Select category</option>
                {categories.map((item) => <option key={item}>{item}</option>)}
              </select>
            </Field>
            <Field label="Priority">
              <select
    value={priority}
    disabled={saving || assessmentLocked}
    onChange={(event) => setPriority(event.target.value)}
  >
                <option value="Not set">Select priority</option>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </Field>
            {isLive && <Field label="Assessment notes" helper="Optional.">
              <textarea rows={4} value={notes} maxLength={2000} disabled={saving || assessmentLocked} onChange={(event) => setNotes(event.target.value)} />
            </Field>}
            {canDecide && <Field
    label="Decision reason"
    helper={isLive ? "Required for rejection. Staff can read the saved reason." : "Record the rationale or feedback that staff should see."}
    error={reasonError}
  >
              <textarea
    rows={4}
    value={decisionReason}
    maxLength={2000}
    disabled={saving}
    aria-invalid={Boolean(reasonError)}
    onChange={(event) => {
      setDecisionReason(event.target.value);
      if (event.target.value.trim()) setReasonError("");
    }}
    placeholder="Explain the decision, key considerations and any next steps..."
  />
            </Field>}
            {saveError && !pendingDecision && <div role="alert" className="assessment-note">{saveError}</div>}
            <div className="assessment-actions">
              {!assessmentLocked && <Button variant="secondary" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save Assessment"}
              </Button>}
              {canDecide && <>
              <Button
    onClick={() => openDecision("Approved")}
    disabled={saving || (!isLive && (Boolean(project) || priority === "Not set" || !decisionReason.trim()))}
  >
                Approve Opportunity
              </Button>
              <Button
    variant="danger"
    onClick={() => openDecision("Rejected")}
    disabled={saving || Boolean(project)}
  >
                Reject
              </Button>
              {!isLive && <Button
    variant="ghost"
    onClick={() => openDecision("Under Review")}
    disabled={Boolean(projectId) || !decisionReason.trim()}
  >
                Keep Under Review
              </Button>}
              </>}
            </div>
            {opportunity.status === "Approved" && !plannedDates && <div className="pipeline-action">
                <div>
                  <strong>{projectId ? "Add planned dates" : "Ready for delivery"}</strong>
                  <span>
                    {projectId
                      ? "The project is already in Not Started. Add a start and target date if you have them."
                      : "Create a linked project and add planned dates if available."}
                  </span>
                </div>
                <Button onClick={() => {
                  setPipelineError("");
                  setPipelineOpen(true);
                }}>
                  {projectId ? "Add planned dates" : "Move to Project Delivery"}
                </Button>
              </div>}
            {projectId && <div className="pipeline-action complete">
                <div>
                  <strong>Linked project: {projectId}</strong>
                  <span>
                    This opportunity is already in Project Delivery.
                  </span>
                </div>
                <Button
    variant="secondary"
    onClick={() => navigate(`/projects/${projectId}`)}
  >
                  View Project
                </Button>
              </div>}
          </Card>}
      </div>
      {confirmDelete && <Modal title="Delete opportunity" onClose={() => setConfirmDelete(false)}>
          <div className="confirm-content">
            <p>
              Delete <strong>{opportunity.title}</strong>? It will be removed from My Opportunities.
            </p>
            {deleteError && <p role="alert">{deleteError}</p>}
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  setDeleteError("");
                  try {
                    await deleteOpportunity(currentUser.email, opportunity.id);
                    navigate("/opportunities");
                  } catch (error) {
                    setDeleteError(error.message);
                    setDeleting(false);
                  }
                }}
              >
                {deleting ? "Deleting…" : "Delete opportunity"}
              </Button>
            </div>
          </div>
        </Modal>}
      {pendingDecision && <Modal
    title={`Confirm ${pendingDecision.toLowerCase()} decision`}
    onClose={closeDecision}
  >
          <div className="confirm-content">
            <p>
              Save this opportunity as <strong>{pendingDecision}</strong>? The
              updated status and decision note will be visible throughout the
              application.
            </p>
            <div className="decision-preview">
              <span>Decision note</span>
              <p>{decisionReason.trim() || "No reason entered."}</p>
            </div>
            {saveError && <div role="alert">{saveError}</div>}
            <div className="modal-actions">
              <Button
    variant="secondary"
    onClick={closeDecision}
    disabled={saving}
  >
                Cancel
              </Button>
              <Button
    variant={pendingDecision === "Rejected" ? "danger" : "primary"}
    onClick={decide}
    disabled={saving}
  >
                {saving ? "Saving…" : "Save Decision"}
              </Button>
            </div>
          </div>
        </Modal>}
      {pendingStatus && <Modal
        title={`Change status to ${pendingStatus}?`}
        onClose={() => { if (!statusSaving) setPendingStatus(null); }}
      >
        <div className="confirm-content">
          <p>
            {pendingStatus === "Completed"
              ? <>Mark this project as <strong>Completed</strong>? It will move to History and the status cannot be changed afterwards.</>
              : <>Change the delivery status from <strong>{deliveryStatus}</strong> to <strong>{pendingStatus}</strong>?</>}
          </p>
          {statusError && <p role="alert" className="error-text">{statusError}</p>}
          <div className="modal-actions">
            <Button type="button" variant="secondary" disabled={statusSaving} onClick={() => setPendingStatus(null)}>Cancel</Button>
            <Button type="button" disabled={statusSaving} onClick={() => changeDeliveryStatus(pendingStatus)}>
              {statusSaving ? "Saving…" : "Confirm status"}
            </Button>
          </div>
        </div>
      </Modal>}
      {pipelineOpen && <Modal
    title="Move to Project Delivery"
    onClose={() => { if (!creatingProject) setPipelineOpen(false); }}
  >
          <form className="modal-form" onSubmit={moveToPipeline}>
            <div className="modal-context">
              <span>{opportunity.id}</span>
              <strong>{opportunity.title}</strong>
              <p>
                {projectId
                  ? "These dates are saved on the project that was created when the opportunity was approved."
                  : `A linked project will be created in the ${isLive ? "Not Started" : "Approved"} column. The original assessment and opportunity record will be preserved.`}
              </p>
            </div>
            <div className="modal-grid">
              <Field label="Planned start date">
                <input
    type="date"
    value={projectForm.startDate}
    onChange={(event) => setProjectForm({
      ...projectForm,
      startDate: event.target.value
    })}
  />
              </Field>
              <Field label="Target completion date">
                <input
    type="date"
    value={projectForm.targetDate}
    onChange={(event) => setProjectForm({
      ...projectForm,
      targetDate: event.target.value
    })}
  />
              </Field>
            </div>
            {pipelineError && <p role="alert" className="error-text">{pipelineError}</p>}
            <div className="modal-actions">
              <Button
    type="button"
    variant="secondary"
    disabled={creatingProject}
    onClick={() => setPipelineOpen(false)}
  >
                Cancel
              </Button>
              <Button type="submit" disabled={creatingProject}>
                {creatingProject ? "Saving…" : projectId ? "Save dates" : "Create Project"}
              </Button>
            </div>
          </form>
        </Modal>}
    </>;
}
