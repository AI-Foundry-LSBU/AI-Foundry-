import { useState } from "react";
import {
  LayoutGrid,
  List
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { benefitGain } from "../components/BenefitCharts";
import { deliveryStatuses, progressForDeliveryStatus } from "../data/projectsApi";
import { useDeliveryProjects } from "../data/useDeliveryProjects";
import { usePotentialBenefits } from "../data/usePotentialBenefits";
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
  const { role, currentUser, updateProject } = useApp();
  const navigate = useNavigate();
  const [view, setView] = useState("kanban");
  const delivery = useDeliveryProjects();
  const potential = usePotentialBenefits();
  const benefitSummary = (project) => {
    const review = potential.reviews.find((item) => item.opportunityId === project.opportunityId && item.recommendation === "worth_pursuing");
    const gains = (review?.benefits ?? []).map(benefitGain).filter((gain) => gain != null);
    if (!gains.length) return "";
    const best = Math.max(...gains);
    return `${gains.length} potential benefit${gains.length === 1 ? "" : "s"}${best ? ` · up to ${best} point${best === 1 ? "" : "s"} less effort` : ""}`;
  };
  if (role === "Staff")
    return <EmptyState
      title="Access restricted"
      text="Project Delivery is available to the AI Foundry delivery team."
      action={<Button onClick={() => navigate("/opportunities")}>
            My Opportunities
          </Button>}
    />;
  if (delivery.loading) return <div role="status"><EmptyState title="Loading projects…" /></div>;
  if (delivery.error) return <div role="alert">
    <EmptyState title="Could not load projects" text={delivery.error.message} action={<Button onClick={delivery.retry}>Try again</Button>} />
  </div>;
  const owned = delivery.isLive && role === "AI Foundry Engineer"
    ? delivery.data.filter((project) => project.assignee?.id === currentUser.id)
    : delivery.data;
  const projects = owned.filter((project) => project.status !== "Completed");
  const statuses = (delivery.isLive ? deliveryStatuses : projectStatuses).filter((status) => status !== "Completed");
  return <>
      <PageHeader
    title="Project Delivery"
    subtitle={role === "AI Foundry Engineer"
      ? "Projects you have assigned to yourself. Completed projects stay in History."
      : "Track approved projects until they are completed. Completed projects stay in History."}
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
      {projects.length === 0 ? <EmptyState
        title={owned.length ? "Completed projects are in History" : role === "AI Foundry Engineer" ? "No projects assigned to you" : "No delivery projects yet"}
        text={owned.length
          ? "A completed project stays in History and its status cannot be changed."
          : role === "AI Foundry Engineer"
            ? "Open Approved Opportunities and assign one to yourself."
            : "A Digital Project Manager can move an approved opportunity to Project Delivery."}
        action={owned.length
          ? <Button onClick={() => navigate("/history")}>History</Button>
          : role === "AI Foundry Engineer"
            ? <Button onClick={() => navigate("/opportunities")}>Approved Opportunities</Button>
            : undefined}
      /> : view === "kanban" ? <div className="kanban">
          {statuses.map((status) => <div className="kanban-column" key={status}>
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
                        {benefitSummary(project) && <p className="project-benefit-line">{benefitSummary(project)}</p>}
                        <div className="card-progress">
                          <div>
                            <i style={{ width: `${progressForDeliveryStatus(project.status)}%` }} />
                          </div>
                          <span>{progressForDeliveryStatus(project.status)}%</span>
                        </div>
                        <div className="project-card-meta">
                          <PriorityBadge priority={project.priority} />
                          <span>Target {project.targetDate}</span>
                        </div>
                      </button>
                      {!delivery.isLive && <select
    aria-label={`Status for ${project.title}`}
    value={project.status}
    onChange={(event) => updateProject(
      project.id,
      { status: event.target.value },
      `Project status changed to ${event.target.value}.`
    )}
  >
                        {projectStatuses.map((item) => <option key={item}>{item}</option>)}
                      </select>}
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
                  <th>Progress</th>
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
                        {benefitSummary(project) && <span className="project-benefit-line">{benefitSummary(project)}</span>}
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
                      <strong>{progressForDeliveryStatus(project.status)}%</strong>
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
