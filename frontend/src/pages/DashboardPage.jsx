import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FolderKanban,
  Gauge,
  Network
} from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { useDeliveryProjects } from "../data/useDeliveryProjects";
import { useOpportunities } from "../data/useOpportunities";
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  StatCard,
  StatusBadge,
  TableAction,
  formatCurrency
} from "../components/ui";
function hoursSaved(records) {
  return records.filter((item) => item.unit === "Hours/month").reduce((sum, item) => sum + item.actual, 0);
}
function annualSavings(records) {
  return records.filter((item) => item.unit === "GBP/year").reduce((sum, item) => sum + item.actual, 0);
}

function ManagerDashboard() {
  const { currentUser, opportunities: samples, benefits } = useApp();
  const navigate = useNavigate();
  const liveManager = currentUser.role === "Digital Project Manager";
  const live = useOpportunities(liveManager ? currentUser.email : null, "all");
  const delivery = useDeliveryProjects();
  if (live.loading) return <div role="status"><EmptyState title="Loading opportunities…" /></div>;
  if (live.error) return <div role="alert">
      <EmptyState title="Could not load opportunities" text={live.error.message} action={<Button onClick={live.retry}>Try again</Button>} />
    </div>;
  const opportunities = liveManager ? live.data : samples;
  const statusCounts = [
    "Submitted",
    "Under Review",
    "Approved",
    "Rejected"
  ].map((status) => ({
    status,
    value: opportunities.filter((item) => item.status === status).length
  }));
  const max = Math.max(...statusCounts.map((item) => item.value), 1);
  const hours = hoursSaved(benefits);
  const savings = annualSavings(benefits);
  const submitted = opportunities.filter((item) => item.status === "Submitted").length;
  const underReview = opportunities.filter((item) => item.status === "Under Review").length;
  const projects = delivery.data ?? [];
  const activeProjects = projects.filter((item) => item.status !== "Completed");
  return <>
      <PageHeader
    title="Management Dashboard"
    subtitle="Review opportunities, follow project delivery and track benefits."
    actions={<Button onClick={() => navigate("/opportunities")}>
            Review opportunities <ArrowRight size={16} />
          </Button>}
  />
      <div className="stats-grid four">
        <StatCard
    label="Total opportunities"
    value={opportunities.length}
    detail="All opportunity records"
    icon={Network}
    tone="blue"
  />
        <StatCard
    label="Under Review"
    value={underReview}
    detail={`${submitted} submitted`}
    icon={Clock3}
    tone="amber"
  />
        <StatCard
    label="Active projects"
    value={delivery.loading || delivery.error ? "—" : activeProjects.length}
    detail="Projects awaiting completion"
    icon={FolderKanban}
    tone="violet"
  />
        <StatCard
    label="Completed projects"
    value={delivery.loading || delivery.error ? "—" : projects.filter((item) => item.status === "Completed").length}
    detail="Marked completed"
    icon={CheckCircle2}
    tone="green"
  />
      </div>
      <div className="dashboard-grid">
        <Card className="span-2">
          <div className="card-header">
            <div>
              <h2>Recent submissions</h2>
              <p>Latest opportunities from across LSBU</p>
            </div>
            <button
    className="text-button"
    onClick={() => navigate("/opportunities")}
  >
              View all <ArrowRight size={15} />
            </button>
          </div>
          <div className="table-wrap fit-table">
            <table>
              <thead>
                <tr>
                  <th>Opportunity</th>
                  <th>Department</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {opportunities.slice(0, 5).map((item) => <tr
    key={item.id}
    onClick={() => navigate(`/opportunities/${item.id}`)}
  >
                    <td>
                      <div className="title-cell">
                        <strong>{item.title}</strong>
                        <span>{item.id}</span>
                      </div>
                    </td>
                    <td>{item.department}</td>
                    <td>{item.submittedDate}</td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td>
                      <TableAction />
                    </td>
                  </tr>)}
              </tbody>
            </table>
          </div>
        </Card>
        <Card>
          <div className="card-header">
            <div>
              <h2>Opportunities by status</h2>
              <p>Current portfolio distribution</p>
            </div>
          </div>
          <div className="bar-chart">
            {statusCounts.map((item) => <div className="bar-row" key={item.status}>
                <span>{item.status}</span>
                <div>
                  <i
    style={{
      width: `${Math.max(item.value / max * 100, 8)}%`
    }}
  />
                </div>
                <strong>{item.value}</strong>
              </div>)}
          </div>
        </Card>
        <Card className="span-2">
          <div className="card-header">
            <div>
              <h2>Project progress overview</h2>
              <p>Manual delivery estimate for each project</p>
            </div>
            <button
    className="text-button"
    onClick={() => navigate("/pipeline")}
  >
              Open Project Delivery <ArrowRight size={15} />
            </button>
          </div>
          {delivery.loading && <p role="status">Loading projects…</p>}
          {delivery.error && <div role="alert">
            <EmptyState title="Could not load projects" text={delivery.error.message} action={<Button onClick={delivery.retry}>Try again</Button>} />
          </div>}
          <div className="project-overview">
            {projects.slice(0, 3).map((project) => {
    const progress = project.progress;
    return <button
      type="button"
      className="project-progress"
      key={project.id}
      onClick={() => navigate(`/projects/${project.id}`)}
    >
                  <div>
                    <strong>{project.title}</strong>
                    <span>
                      {project.department} · {project.status}
                    </span>
                  </div>
                  <div className="progress-track">
                    <i style={{ width: `${progress}%` }} />
                  </div>
                  <b>{progress}%</b>
                </button>;
  })}
          </div>
        </Card>
        <Card className="benefit-summary">
          <div className="card-header">
            <div>
              <h2>Benefits summary</h2>
              <p>Validated and forecast impact</p>
            </div>
          </div>
          <div className="benefit-highlight">
            <Clock3 size={20} />
            <div>
              <strong>{hours} hours/month</strong>
              <span>actual time saved</span>
            </div>
          </div>
          <div className="benefit-highlight">
            <CircleDollarSign size={20} />
            <div>
              <strong>{formatCurrency(savings)}/year</strong>
              <span>actual financial savings</span>
            </div>
          </div>
          <Button variant="secondary" onClick={() => navigate("/benefits")}>
            View benefits
          </Button>
        </Card>
      </div>
    </>;
}

function EngineerDashboard() {
  const { benefits } = useApp();
  const navigate = useNavigate();
  const delivery = useDeliveryProjects();
  if (delivery.loading) return <div role="status"><EmptyState title="Loading projects…" /></div>;
  if (delivery.error) return <div role="alert">
    <EmptyState title="Could not load projects" text={delivery.error.message} action={<Button onClick={delivery.retry}>Try again</Button>} />
  </div>;
  const projects = delivery.data;
  const countStatus = (status) => projects.filter((item) => item.status === status).length;
  const hours = hoursSaved(benefits);
  const savings = annualSavings(benefits);
  return <>
      <PageHeader
    title="Delivery Dashboard"
    subtitle="Follow approved projects from planning through to completion."
    actions={<Button onClick={() => navigate("/pipeline")}>
            Open Project Delivery <ArrowRight size={16} />
          </Button>}
  />
      <div className="stats-grid four">
        <StatCard
    label={delivery.isLive ? "Not Started" : "Approved"}
    value={countStatus(delivery.isLive ? "Not Started" : "Approved")}
    detail="Awaiting delivery"
    icon={BriefcaseBusiness}
    tone="blue"
  />
        <StatCard
    label={delivery.isLive ? "Testing" : "Planned"}
    value={countStatus(delivery.isLive ? "Testing" : "Planned")}
    icon={CalendarDays}
    tone="amber"
  />
        <StatCard
    label="In Progress"
    value={countStatus("In Progress")}
    icon={Gauge}
    tone="violet"
  />
        <StatCard
    label="Completed"
    value={countStatus("Completed")}
    icon={CheckCircle2}
    tone="green"
  />
      </div>
      <div className="dashboard-grid">
        <Card className="span-2">
          <div className="card-header">
            <div>
              <h2>Project Delivery</h2>
              <p>Approved projects and their target dates</p>
            </div>
            <button
    className="text-button"
    onClick={() => navigate("/pipeline")}
  >
              View all <ArrowRight size={15} />
            </button>
          </div>
          <div className="table-wrap fit-table">
            <table>
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Department</th>
                  <th>Target date</th>
                  <th>Status</th>
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
                    <td>{project.targetDate}</td>
                    <td>
                      <StatusBadge status={project.status} />
                    </td>
                    <td>
                      <TableAction />
                    </td>
                  </tr>)}
              </tbody>
            </table>
          </div>
        </Card>
        <Card className="benefit-summary">
          <div className="card-header">
            <div>
              <h2>Benefits recorded</h2>
              <p>Measures linked to project delivery</p>
            </div>
          </div>
          <div className="benefit-highlight">
            <Clock3 size={20} />
            <div>
              <strong>{hours} hours/month</strong>
              <span>actual time saved</span>
            </div>
          </div>
          <div className="benefit-highlight">
            <BarChart3 size={20} />
            <div>
              <strong>{formatCurrency(savings)}/year</strong>
              <span>actual financial savings</span>
            </div>
          </div>
          <Button variant="secondary" onClick={() => navigate("/benefits")}>
            View benefits
          </Button>
        </Card>
      </div>
    </>;
}

export function DashboardPage() {
  const { role } = useApp();
  if (role === "Staff") return <Navigate to="/opportunities" replace />;
  if (role === "AI Foundry Engineer") return <EngineerDashboard />;
  return <ManagerDashboard />;
}
