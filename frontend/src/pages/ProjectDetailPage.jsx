import { useState } from "react";
import {
  ArrowLeft
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { claimDeliveryProject, engineerDeliveryStatuses, progressForDeliveryStatus, updateDeliveryProject } from "../data/projectsApi";
import { useBenefits } from "../data/useBenefits";
import { useDeliveryProjects } from "../data/useDeliveryProjects";
import { projectStatuses } from "../data/options";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Modal,
  PriorityBadge,
  StatusBadge,
  formatMeasure
} from "../components/ui";

export function ProjectDetailPage() {
  const { id } = useParams();
  const { role, currentUser } = useApp();
  const navigate = useNavigate();
  const delivery = useDeliveryProjects(id);

  if (role === "Staff") return <EmptyState
    title="Access restricted"
    text="Project delivery is available to the AI Foundry team."
    action={<Button onClick={() => navigate("/opportunities")}>My Opportunities</Button>}
  />;
  if (delivery.loading) return <div role="status"><EmptyState title="Loading project…" /></div>;
  if (delivery.error && delivery.error.status !== 404) return <div role="alert">
    <EmptyState title="Could not load project" text={delivery.error.message} action={<Button onClick={delivery.retry}>Try again</Button>} />
  </div>;
  if (!delivery.data) return <EmptyState
    title="Project not found"
    text="Return to Project Delivery to select another project."
    action={<Button onClick={() => navigate("/pipeline")}>Project Delivery</Button>}
  />;

  return <ProjectDetail
    key={`${currentUser.email}:${role}:${id}`}
    initialProject={delivery.data}
    isLive={delivery.isLive}
  />;
}

function ProjectDetail({ initialProject, isLive }) {
  const { role, currentUser, updateProject } = useApp();
  const navigate = useNavigate();
  const benefits = useBenefits(initialProject.id);
  const [savedProject, setSavedProject] = useState(null);
  const project = savedProject ?? initialProject;
  const [status, setStatus] = useState(initialProject.status);
  const stageProgress = progressForDeliveryStatus(project.status);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [pendingStatus, setPendingStatus] = useState(null);
  const confirmStatus = async () => {
    if (!pendingStatus || saving || project.status === "Completed") return;
    if (!isLive) {
      updateProject(project.id, { status: pendingStatus }, `Project status changed to ${pendingStatus}.`);
      setPendingStatus(null);
      return;
    }
    setFeedback(null);
    setSaving(true);
    try {
      const updated = await updateDeliveryProject(currentUser.email, project.id, { status: pendingStatus });
      setSavedProject(updated);
      setStatus(updated.status);
      setPendingStatus(null);
      setFeedback({ message: `Status changed to ${updated.status}.` });
    } catch (error) {
      setFeedback({ error: true, message: Object.values(error.fields ?? {})[0] ?? error.message });
    } finally {
      setSaving(false);
    }
  };

  const saveProgress = async (event) => {
    event.preventDefault();
    if (saving || (status === project.status && !note.trim())) return;
    setFeedback(null);
    setSaving(true);
    try {
      const updated = await updateDeliveryProject(currentUser.email, project.id, {
        status: project.status === "Completed" || status === project.status ? undefined : status,
        note: note.trim() || undefined,
      });
      setSavedProject(updated);
      setStatus(updated.status);
      setNote("");
      setFeedback({ message: "Project progress saved." });
    } catch (error) {
      setFeedback({ error: true, message: Object.values(error.fields ?? {})[0] ?? error.message });
    } finally {
      setSaving(false);
    }
  };
  const projectBenefits = benefits.data ?? [];
  const addNote = () => {
    if (!note.trim()) return;
    updateProject(project.id, { notes: note }, note);
    setNote("");
  };
  return <>
      <button className="back-link" onClick={() => navigate(project.status === "Completed" ? "/history" : "/pipeline")}>
        <ArrowLeft size={17} /> {project.status === "Completed" ? "Back to History" : "Back to Project Delivery"}
      </button>
      <div className="detail-heading">
        <div>
          <div className="detail-kicker">
            <span className="mono">{project.id}</span>
            <StatusBadge status={project.status} />
          </div>
          <h1>{project.title}</h1>
          <p><Link to={`/opportunities/${project.opportunityId}`}>Open the opportunity</Link></p>
        </div>
        <PriorityBadge priority={project.priority} />
      </div>
      <div className="project-detail-grid">
        <div className="detail-content">
          <Card>
            <div className="card-header">
              <div>
                <h2>Project details</h2>
                <p>Delivery dates and key milestones</p>
              </div>
            </div>
            <div className="meta-grid">
              <div>
                <span>Department</span>
                <strong>{project.department}</strong>
              </div>
              <div>
                <span>Start date</span>
                <strong>{project.startDate}</strong>
              </div>
              <div>
                <span>Target completion</span>
                <strong>{project.targetDate}</strong>
              </div>
            </div>
            <div className="manual-progress">
              <div>
                <span>Stage progress</span>
                <strong>{stageProgress}%</strong>
              </div>
              <div className="progress-track">
                <i style={{ width: `${stageProgress}%` }} />
              </div>
            </div>
          </Card>
          {(benefits.loading || benefits.error || projectBenefits.length > 0) && <Card>
            <div className="card-header">
              <div>
                <h2>Associated benefits</h2>
                <p>Benefit measures recorded during delivery</p>
              </div>
              <span className="category-pill">
                {projectBenefits.length} recorded
              </span>
            </div>
            {benefits.loading ? <p role="status">Loading benefits…</p> : benefits.error ? <div role="alert">
              <EmptyState title="Could not load benefits" text={benefits.error.message} action={<Button onClick={benefits.retry}>Try again</Button>} />
            </div> : <div className="table-wrap fit-table">
                <table>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Measurement</th>
                      <th>Estimated</th>
                      <th>Actual</th>
                      <th>Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectBenefits.map((benefit) => <tr key={benefit.id}>
                        <td>
                          <span className="category-pill">
                            {benefit.category}
                          </span>
                        </td>
                        <td>{benefit.measurement}</td>
                        <td>{formatMeasure(benefit.estimated, benefit.unit)}</td>
                        <td>
                          <strong>{formatMeasure(benefit.actual, benefit.unit)}</strong>
                        </td>
                        <td>{benefit.unit}</td>
                      </tr>)}
                  </tbody>
                </table>
              </div>}
          </Card>}
        </div>
        <Card className="project-controls">
          <div className="card-header">
            <div>
              <h2>Updates</h2>
              <p>{project.assignee ? `Assigned to ${project.assignee.name}` : "Not assigned yet"}</p>
            </div>
          </div>
          {isLive && role === "AI Foundry Engineer" && project.assignee?.id !== currentUser.id ? <div className="assessment-note">
            <p>{project.assignee ? `${project.assignee.name} is working on this project.` : "Assign this project to yourself before updating it."}</p>
            {!project.assignee && <Button onClick={async () => {
              setSaving(true);
              try {
                setSavedProject(await claimDeliveryProject(currentUser.email, project.id));
              } catch (error) {
                setFeedback({ error: true, message: error.message });
              } finally {
                setSaving(false);
              }
            }}>Assign to me</Button>}
          </div> : isLive && role === "Digital Project Manager" ? <div className="project-status-room">
            <span>Current status</span>
            <strong>{project.status}</strong>
          </div> : isLive ? <form onSubmit={saveProgress}>
            <Field label="Current status" helper={project.status === "Completed" ? "A completed project stays completed." : "Move the project from In Progress to Completed."}>
              <select
                value={status}
                disabled={saving || project.status === "Completed"}
                onChange={(event) => {
                  const next = event.target.value;
                  if (next !== project.status) setPendingStatus(next);
                }}
              >
                {engineerDeliveryStatuses(project.status).map((item) => <option key={item}>{item}</option>)}
              </select>
            </Field>
            <Field label="Project update">
              <textarea
                rows={5}
                maxLength={2000}
                value={note}
                disabled={saving}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Share completed work or a blocker..."
              />
            </Field>
            {feedback && <p role={feedback.error ? "alert" : "status"}>{feedback.message}</p>}
            <Button
              type="submit"
              disabled={saving || (status === project.status && !note.trim())}
            >
              {saving ? "Saving…" : "Save Progress"}
            </Button>
          </form> : <>
          <Field label="Current status" helper={project.status === "Completed" ? "A completed project stays completed." : undefined}>
            <select
    value={project.status}
    disabled={project.status === "Completed"}
    onChange={(event) => {
      if (event.target.value !== project.status) setPendingStatus(event.target.value);
    }}
  >
              {projectStatuses.map((item) => <option key={item}>{item}</option>)}
            </select>
          </Field>
          <Field
    label="Progress estimate"
    helper="Manual estimate only; 0% to 100%."
  >
            <input
    type="number"
    min="0"
    max="100"
    value={project.progress}
    onChange={(event) => {
      const progress = Math.min(
        100,
        Math.max(0, Number(event.target.value))
      );
      updateProject(
        project.id,
        { progress },
        `Manual progress estimate updated to ${progress}%.`
      );
    }}
  />
          </Field>
          <Field label="Add progress update">
            <textarea
    rows={5}
    value={note}
    onChange={(event) => setNote(event.target.value)}
    placeholder="Share the latest delivery progress, decision or blocker..."
  />
          </Field>
          <Button onClick={addNote}>Add Progress Update</Button>
          </>}
          <div className="progress-notes">
            <h3>Progress notes</h3>
            {project.activity.length === 0 && <p className="activity-empty">No updates recorded yet.</p>}
            <div className="activity-list">
              {project.activity.map((item, index) => <div className="activity-item" key={item.id ?? `${item.date}-${index}`}>
                  <div className="activity-dot" />
                  <div>
                    <strong>{item.text}</strong>
                    <span>{item.author} · {item.date}</span>
                  </div>
                </div>)}
            </div>
          </div>
        </Card>
      </div>
      {pendingStatus && <Modal
        title={`Change status to ${pendingStatus}?`}
        onClose={() => { if (!saving) setPendingStatus(null); }}
      >
        <div className="confirm-content">
          <p>
            {pendingStatus === "Completed"
              ? <>Mark this project as <strong>Completed</strong>? It will move to History and the status cannot be changed afterwards.</>
              : <>Change the delivery status from <strong>{project.status}</strong> to <strong>{pendingStatus}</strong>?</>}
          </p>
          {feedback?.error && <p role="alert" className="error-text">{feedback.message}</p>}
          <div className="modal-actions">
            <Button type="button" variant="secondary" disabled={saving} onClick={() => setPendingStatus(null)}>Cancel</Button>
            <Button type="button" disabled={saving} onClick={confirmStatus}>
              {saving ? "Saving…" : "Confirm status"}
            </Button>
          </div>
        </div>
      </Modal>}
    </>;
}
