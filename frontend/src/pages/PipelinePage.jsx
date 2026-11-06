import { useState } from "react";
import {
  LayoutGrid,
  List
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { projectStatuses } from "../data/options";
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  PriorityBadge,
  StatusBadge,
  TableAction
} from "../components/ui";

export function PipelinePage() {
  const { role, projects, updateProject } = useApp();
  const navigate = useNavigate();
  const [view, setView] = useState("kanban");
  if (role === "Staff")
    return <EmptyState
      title="Access restricted"
      text="Project Delivery is available to the AI Foundry delivery team."
      action={<Button onClick={() => navigate("/dashboard")}>
            Return to dashboard
          </Button>}
    />;
  return <>
      <PageHeader
    title="Project Delivery"
    subtitle="Track approved projects from planning to completion."
    actions={<div className="view-toggle">
            <button
      className={view === "kanban" ? "active" : ""}
      onClick={() => setView("kanban")}
    >
              <LayoutGrid size={16} /> Kanban
            </button>
            <button
      className={view === "table" ? "active" : ""}
      onClick={() => setView("table")}
    >
              <List size={16} /> Table
            </button>
          </div>}
  />
      {view === "kanban" ? <div className="kanban">
          {projectStatuses.map((status) => <div className="kanban-column" key={status}>
              <div className="kanban-title">
                <div>
                  <i
    className={`dot dot-${status.toLowerCase().replaceAll(" ", "-")}`}
  />
                  <strong>{status}</strong>
                </div>
                <span>
                  {projects.filter((item) => item.status === status).length}
                </span>
              </div>
              <div className="kanban-list">
                {projects.filter((item) => item.status === status).map((project) => <Card className="project-card" key={project.id}>
                      <button
    className="project-card-main"
    onClick={() => navigate(`/projects/${project.id}`)}
  >
                        <span className="mono">{project.id}</span>
                        <h3>{project.title}</h3>
                        <p>{project.department}</p>
                        <div className="card-progress">
                          <div>
                            <i style={{ width: `${project.progress}%` }} />
                          </div>
                          <span>Manual estimate {project.progress}%</span>
                        </div>
                        <div className="project-card-meta">
                          <PriorityBadge priority={project.priority} />
                          <span>Target {project.targetDate}</span>
                        </div>
                      </button>
                      <select
    aria-label={`Status for ${project.title}`}
    value={project.status}
    onChange={(event) => updateProject(
      project.id,
      { status: event.target.value },
      `Project status changed to ${event.target.value}.`
    )}
  >
                        {projectStatuses.map((item) => <option key={item}>{item}</option>)}
                      </select>
                    </Card>)}
              </div>
            </div>)}
        </div> : <Card>
          <div className="table-wrap fit-table">
            <table>
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Department</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Target date</th>
                  <th>Manual estimate</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => <tr
    key={project.id}
    onClick={() => navigate(`/projects/${project.id}`)}
  >
                    <td>
                      <div className="title-cell">
                        <strong>{project.title}</strong>
                        <span>{project.id}</span>
                      </div>
                    </td>
                    <td>{project.department}</td>
                    <td>
                      <PriorityBadge priority={project.priority} />
                    </td>
                    <td>
                      <StatusBadge status={project.status} />
                    </td>
                    <td>{project.targetDate}</td>
                    <td>
                      <strong>{project.progress}%</strong>
                    </td>
                    <td>
                      <TableAction />
                    </td>
                  </tr>)}
              </tbody>
            </table>
          </div>
        </Card>}
    </>;
}
