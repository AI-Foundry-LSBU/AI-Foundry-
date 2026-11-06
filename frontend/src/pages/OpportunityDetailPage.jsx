import { useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  X
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { categories } from "../data/options";
import { useStaffOpportunities } from "../data/useStaffOpportunities";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Modal,
  PriorityBadge,
  StatusBadge
} from "../components/ui";

export function OpportunityDetailPage() {
  const { id } = useParams();
  const {
    role,
    currentUser,
    opportunities,
    projects,
    assessOpportunity,
    decideOpportunity,
    createProject
  } = useApp();
  const navigate = useNavigate();
  const isStaff = role === "Staff";
  const staff = useStaffOpportunities(isStaff ? currentUser.email : null, id);
  const opportunity = isStaff ? staff.data : opportunities.find((item) => item.id === id);
  const [priority, setPriority] = useState(
    opportunity?.priority ?? "Not set"
  );
  const [category, setCategory] = useState(
    opportunity?.category === "Uncategorised" ? "" : opportunity?.category ?? ""
  );
  const [ratings, setRatings] = useState(
    opportunity?.assessment ?? {
      "Strategic alignment": 0,
      "Benefit potential": 0,
      Complexity: 0,
      "Resource requirements": 0,
      "Speed to value": 0
    }
  );
  const [assessmentComments, setAssessmentComments] = useState(opportunity?.assessmentComments ?? {});
  const [decisionReason, setDecisionReason] = useState(
    opportunity?.decisionReason ?? ""
  );
  const [message, setMessage] = useState("");
  const [pendingDecision, setPendingDecision] = useState(null);
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const [projectForm, setProjectForm] = useState({
    startDate: "",
    targetDate: ""
  });
  if (staff.loading) return <div role="status"><EmptyState title="Loading opportunity…" /></div>;
  if (staff.error && staff.error.status !== 404) {
    const forbidden = staff.error.status === 403;
    return <div role="alert">
        <EmptyState
          title={forbidden ? "Access restricted" : "Could not load this opportunity"}
          text={staff.error.message}
          action={forbidden
            ? <Button onClick={() => navigate("/opportunities")}>Back to opportunities</Button>
            : <Button onClick={staff.retry}>Try again</Button>}
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
  const isManager = role === "Digital Project Manager";
  const isEngineer = role === "AI Foundry Engineer";
  const project = projects.find((item) => item.opportunityId === opportunity.id);
  const isRestricted = isEngineer && opportunity.status !== "Approved";
  if (isRestricted)
    return <EmptyState
      title="Access restricted"
      text="This record is not available for the selected role."
      action={<Button onClick={() => navigate("/dashboard")}>
            Return to dashboard
          </Button>}
    />;
  const rejected = opportunity.status === "Rejected";
  const pending = opportunity.status === "Submitted" || opportunity.status === "Under Review";
  const stages = pending
    ? ["Submitted", "Under Review", "Decision"]
    : rejected
      ? ["Submitted", "Under Review", "Rejected"]
      : ["Submitted", "Under Review", "Approved", "In Progress", "Completed"];
  const currentIndex = stages.indexOf(opportunity.status);
  const criterionGuidance = {
    "Strategic alignment": "1 = limited connection to LSBU priorities \xB7 5 = directly advances a key priority",
    "Benefit potential": "1 = limited or uncertain benefit \xB7 5 = substantial, measurable benefit",
    Complexity: "1 = straightforward delivery \xB7 5 = significant technical or organisational complexity",
    "Resource requirements": "1 = minimal resource requirement \xB7 5 = major specialist or team commitment",
    "Speed to value": "1 = long lead time to benefit \xB7 5 = value can be demonstrated quickly"
  };
  const save = () => {
    const saved = assessOpportunity(
      opportunity.id,
      priority,
      ratings,
      assessmentComments,
      category || "Uncategorised"
    );
    if (saved) setMessage("Assessment saved successfully.");
  };
  const decide = () => {
    if (!pendingDecision) return;
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
  const moveToPipeline = (event) => {
    event.preventDefault();
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
        {isStaff ? "my opportunities" : "all opportunities"}
      </button>
      <div className="detail-heading">
        <div>
          <div className="detail-kicker">
            <span className="mono">{opportunity.id}</span>
            <StatusBadge status={opportunity.status} />
          </div>
          <h1>{opportunity.title}</h1>
          <p>
            Submitted by {opportunity.submittedBy} on{" "}
            {opportunity.submittedDate}
          </p>
        </div>
        {opportunity.priority !== "Not set" && <PriorityBadge priority={opportunity.priority} />}
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
              {rejected ? "This opportunity was not progressed following assessment." : "Track this opportunity through the review and decision process."}
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
      <div className={`detail-grid ${isManager ? "management" : ""}`}>
        <div className="detail-content">
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
          {opportunity.decisionReason && <Card>
              <div className="card-header">
                <div>
                  <h2>AI Foundry decision</h2>
                  <p>Review outcome and feedback from the assessment team</p>
                </div>
                <StatusBadge status={opportunity.status} />
              </div>
              <div className="narrative">
                <span>Decision reason</span>
                <p>{opportunity.decisionReason}</p>
              </div>
            </Card>}
          {project && <Card>
              <div className="card-header">
                <div>
                  <h2>Project delivery</h2>
                  <p>
                    This approved opportunity is now tracked as a separate
                    delivery project.
                  </p>
                </div>
                <StatusBadge status={project.status} />
              </div>
              <div className="meta-grid">
                <div>
                  <span>Project reference</span>
                  <strong>{project.id}</strong>
                </div>
                <div>
                  <span>Delivery status</span>
                  <strong>{project.status}</strong>
                </div>
                <div>
                  <span>Target completion</span>
                  <strong>{project.targetDate}</strong>
                </div>
              </div>
            </Card>}
        </div>
        {isManager && <Card className="assessment-card">
            <div className="card-header">
              <div>
                <h2>Opportunity Assessment</h2>
                <p>
                  Rate each criterion independently, then set a manual priority.
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
  >
                          {rating}
                        </button>)}
                    </div>
                  </div>
                  <textarea
    rows={2}
    value={assessmentComments[criterion] ?? ""}
    onChange={(event) => setAssessmentComments((current) => ({
      ...current,
      [criterion]: event.target.value
    }))}
    placeholder={`Optional comments about ${criterion.toLowerCase()}...`}
  />
                </div>)}
            </div>
            <Field
    label="Category"
    helper="Set during triage; staff do not categorise submissions."
  >
              <select
    value={category}
    onChange={(event) => setCategory(event.target.value)}
  >
                <option value="">Select category</option>
                {categories.map((item) => <option key={item}>{item}</option>)}
              </select>
            </Field>
            <Field
    label="Manual priority"
    helper="Criteria are not automatically weighted or combined."
  >
              <select
    value={priority}
    onChange={(event) => setPriority(event.target.value)}
  >
                <option value="Not set">Select priority</option>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </Field>
            <Field
    label="Decision reason"
    helper="Record the rationale or feedback that staff should see."
  >
              <textarea
    rows={4}
    value={decisionReason}
    onChange={(event) => setDecisionReason(event.target.value)}
    placeholder="Explain the decision, key considerations and any next steps..."
  />
            </Field>
            <div className="assessment-note">
              Illustrative rating controls only. Scoring direction and weighting
              must be agreed with the client before any automatic calculation.
            </div>
            <div className="assessment-actions">
              <Button variant="secondary" onClick={save}>
                Save Assessment
              </Button>
              <Button
    onClick={() => setPendingDecision("Approved")}
    disabled={Boolean(project) || priority === "Not set" || !decisionReason.trim()}
  >
                Approve Opportunity
              </Button>
              <Button
    variant="danger"
    onClick={() => setPendingDecision("Rejected")}
    disabled={Boolean(project) || !decisionReason.trim()}
  >
                Reject
              </Button>
              <Button
    variant="ghost"
    onClick={() => setPendingDecision("Under Review")}
    disabled={Boolean(project) || !decisionReason.trim()}
  >
                Keep Under Review
              </Button>
            </div>
            {opportunity.status === "Approved" && !project && <div className="pipeline-action">
                <div>
                  <strong>Ready for delivery</strong>
                  <span>
                    Create a linked project when delivery dates are known.
                  </span>
                </div>
                <Button onClick={() => setPipelineOpen(true)}>
                  Move to Project Delivery
                </Button>
              </div>}
            {project && <div className="pipeline-action complete">
                <div>
                  <strong>Linked project: {project.id}</strong>
                  <span>
                    This opportunity is already in Project Delivery.
                  </span>
                </div>
                <Button
    variant="secondary"
    onClick={() => navigate(`/projects/${project.id}`)}
  >
                  View Project
                </Button>
              </div>}
          </Card>}
      </div>
      {pendingDecision && <Modal
    title={`Confirm ${pendingDecision.toLowerCase()} decision`}
    onClose={() => setPendingDecision(null)}
  >
          <div className="confirm-content">
            <p>
              Save this opportunity as <strong>{pendingDecision}</strong>? The
              updated status and decision note will be visible throughout the
              application.
            </p>
            <div className="decision-preview">
              <span>Decision note</span>
              <p>{decisionReason}</p>
            </div>
            <div className="modal-actions">
              <Button
    variant="secondary"
    onClick={() => setPendingDecision(null)}
  >
                Cancel
              </Button>
              <Button
    variant={pendingDecision === "Rejected" ? "danger" : "primary"}
    onClick={decide}
  >
                Save Decision
              </Button>
            </div>
          </div>
        </Modal>}
      {pipelineOpen && <Modal
    title="Move to Project Delivery"
    onClose={() => setPipelineOpen(false)}
  >
          <form className="modal-form" onSubmit={moveToPipeline}>
            <div className="modal-context">
              <span>{opportunity.id}</span>
              <strong>{opportunity.title}</strong>
              <p>
                A linked project will be created in the Approved column. The
                original assessment and opportunity record will be preserved.
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
            <div className="modal-actions">
              <Button
    type="button"
    variant="secondary"
    onClick={() => setPipelineOpen(false)}
  >
                Cancel
              </Button>
              <Button type="submit">Create Project</Button>
            </div>
          </form>
        </Modal>}
    </>;
}
