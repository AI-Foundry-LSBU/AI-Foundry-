import { useState } from "react";
import {
  ArrowLeft
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useApp } from "../context/AppContext";
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
  const { role, projects, opportunities, benefits, updateProject } = useApp();
  const navigate = useNavigate();
  const project = projects.find((item) => item.id === id);
  const [note, setNote] = useState("");
  if (!project)
    return <EmptyState
      title="Project not found"
      text="Return to Project Delivery to select another project."
    />;
  const isRestricted = role === "Staff";
  if (isRestricted)
    return <EmptyState
      title="Access restricted"
      text="Project delivery is available to the AI Foundry team."
      action={<Button onClick={() => navigate("/opportunities")}>
            My Opportunities
          </Button>}
    />;
  const opportunity = opportunities.find(
    (item) => item.id === project.opportunityId
  );
  const projectBenefits = benefits.filter(
    (item) => item.projectId === project.id
  );
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
            {projectBenefits.length ? <div className="table-wrap fit-table">
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
                <h2>Activity</h2>
                <p>Chronological delivery updates</p>
              </div>
            </div>
            <div className="activity-list">
              {project.activity.map((item, index) => <div className="activity-item" key={`${item.date}-${index}`}>
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
        </Card>
      </div>
    </>;
}
