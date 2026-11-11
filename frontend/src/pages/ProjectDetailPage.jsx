import { useState } from "react";
import {
  ArrowLeft
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { deliveryStatuses, updateDeliveryProject } from "../data/projectsApi";
import { useBenefits } from "../data/useBenefits";
import { useDeliveryProjects } from "../data/useDeliveryProjects";
import { projectStatuses } from "../data/options";
import {
  Button,
  Card,
  EmptyState,
  Field,
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
  const { currentUser, opportunities, updateProject } = useApp();
  const navigate = useNavigate();
  const benefits = useBenefits(initialProject.id);
  const [savedProject, setSavedProject] = useState(null);
  const project = savedProject ?? initialProject;
  const [status, setStatus] = useState(initialProject.status);
  const [progress, setProgress] = useState(initialProject.progress);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const saveProgress = async (event) => {
    event.preventDefault();
    if (saving || (status === project.status && progress === project.progress && !note.trim())) return;
    setFeedback(null);
    setSaving(true);
    try {
      const updated = await updateDeliveryProject(currentUser.email, project.id, {
        status: status === project.status ? undefined : status,
        progress: status === "Completed" || progress === project.progress ? undefined : progress,
        note: note.trim() || undefined,
      });
      setSavedProject(updated);
      setStatus(updated.status);
      setProgress(updated.progress);
      setNote("");
      setFeedback({ message: "Project progress saved." });
    } catch (error) {
      setFeedback({ error: true, message: Object.values(error.fields ?? {})[0] ?? error.message });
    } finally {
      setSaving(false);
    }
  };
  const opportunity = opportunities.find(
    (item) => item.id === project.opportunityId
  );
  const projectBenefits = benefits.data ?? [];
  const addNote = () => {
    if (!note.trim()) return;
    updateProject(project.id, { notes: note }, note);
    setNote("");
  };
  return <>
      <button className="back-link" onClick={() => navigate("/pipeline")}>
        <ArrowLeft size={17} /> Back to Project Delivery
      </button>
      <div className="detail-heading">
        <div>
          <div className="detail-kicker">
            <span className="mono">{project.id}</span>
            <StatusBadge status={project.status} />
          </div>
          <h1>{project.title}</h1>
          <p>{project.description}</p>
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
            <div className="narrative">
              <span>Latest progress</span>
              <p>{project.notes}</p>
            </div>
            <div className="manual-progress">
              <div>
                <span>Manual progress estimate</span>
                <strong>{project.progress}%</strong>
              </div>
              <div className="progress-track">
                <i style={{ width: `${project.progress}%` }} />
              </div>
              <p>
                This percentage is a manual delivery estimate and is not
                calculated from tasks or milestones.
              </p>
            </div>
          </Card>
          {opportunity && <Card>
              <div className="card-header">
                <div>
                  <h2>Original opportunity</h2>
                  <p>{opportunity.id} · Assessment and submission context</p>
                </div>
                <StatusBadge status={opportunity.status} />
              </div>
              <div className="narrative">
                <span>Problem Description</span>
                <p>{opportunity.problem}</p>
              </div>
              <div className="narrative">
                <span>Suggested Improvement</span>
                <p>{opportunity.improvement}</p>
              </div>
            </Card>}
          <Card>
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
            </div> : projectBenefits.length ? <div className="table-wrap fit-table">
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
              </div> : <EmptyState
    title="No benefits recorded yet"
    text="Benefits can be added as evidence becomes available during delivery."
  />}
          </Card>
          <Card>
            <div className="card-header">
              <div>
                <h2>{isLive ? "Progress notes" : "Activity"}</h2>
                <p>Latest delivery updates first</p>
              </div>
            </div>
            {project.activity.length === 0 && <p>No updates recorded yet.</p>}
            <div className="activity-list">
              {project.activity.map((item, index) => <div className="activity-item" key={item.id ?? `${item.date}-${index}`}>
                  <div className="activity-dot" />
                  <div>
                    <strong>{item.text}</strong>
                    <span>
                      {item.author} · {item.date}
                    </span>
                  </div>
                </div>)}
            </div>
          </Card>
        </div>
        <Card className="project-controls">
          <div className="card-header">
            <div>
              <h2>Manage project</h2>
              <p>Update delivery status and record progress</p>
            </div>
          </div>
          {isLive ? <form onSubmit={saveProgress}>
            <Field label="Current status">
              <select value={status} disabled={saving} onChange={(event) => setStatus(event.target.value)}>
                {deliveryStatuses.map((item) => <option key={item}>{item}</option>)}
              </select>
            </Field>
            <Field label="Progress estimate" helper="A completed project is marked 100%.">
              <input
                type="number"
                min="0"
                max="100"
                required
                value={status === "Completed" ? 100 : progress}
                disabled={saving || status === "Completed"}
                onChange={(event) => setProgress(event.target.value === "" ? "" : Number(event.target.value))}
              />
            </Field>
            <Field label="Add progress note">
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
              disabled={saving || (status === project.status && progress === project.progress && !note.trim())}
            >
              {saving ? "Saving…" : "Save Progress"}
            </Button>
          </form> : <>
          <Field label="Current status">
            <select
    value={project.status}
    onChange={(event) => updateProject(
      project.id,
      { status: event.target.value },
      `Project status changed to ${event.target.value}.`
    )}
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
        </Card>
      </div>
    </>;
}
