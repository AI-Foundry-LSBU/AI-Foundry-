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
  Network,
  Plus
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import {
  Button,
  Card,
  PageHeader,
  StatCard,
  StatusBadge,
  TableAction,
  formatCurrency
} from "../components/ui";

function ManagerDashboard() {
  const { opportunities, projects, benefits } = useApp();
  const navigate = useNavigate();
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
  const hours = benefits.filter((item) => item.unit === "Hours/month").reduce((sum, item) => sum + item.actual, 0);
  const savings = benefits.filter((item) => item.unit === "GBP/year").reduce((sum, item) => sum + item.actual, 0);
  return <>
      <PageHeader
    eyebrow="Management overview"
    title="AI Foundry Dashboard"
    subtitle="Manage improvement opportunities, monitor project delivery and track benefits."
    actions={<Button onClick={() => navigate("/opportunities")}>
            Review opportunities <ArrowRight size={16} />
          </Button>}
  />
      <div className="stats-grid four">
        <StatCard
    label="Total opportunities"
    value={opportunities.length}
    detail="Current review portfolio"
    icon={Network}
    tone="blue"
  />
        <StatCard
    label="Awaiting review"
    value={opportunities.filter(
      (item) => item.status === "Submitted" || item.status === "Under Review"
    ).length}
    detail={`${opportunities.filter((item) => item.status === "Submitted").length} need initial triage`}
    icon={Clock3}
    tone="amber"
  />
        <StatCard
    label="Active projects"
    value={projects.filter((item) => item.status !== "Completed").length}
    detail={`Across ${new Set(projects.filter((item) => item.status !== "Completed").map((item) => item.department)).size} departments`}
    icon={FolderKanban}
    tone="violet"
  />
        <StatCard
    label="Completed projects"
    value={projects.filter((item) => item.status === "Completed").length}
    detail="Delivery portfolio total"
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
          <div className="table-wrap">
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
              <p>Delivery health across the active pipeline</p>
            </div>
            <button
    className="text-button"
    onClick={() => navigate("/pipeline")}
  >
              Open pipeline <ArrowRight size={15} />
            </button>
          </div>
          <div className="project-overview">
            {projects.slice(0, 3).map((project) => {
    const progress = project.progress;
    return <div className="project-progress" key={project.id}>
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
                </div>;
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
              <strong>{hours}</strong>
              <span>hours saved / month</span>
            </div>
          </div>
          <div className="benefit-highlight">
            <CircleDollarSign size={20} />
            <div>
              <strong>{formatCurrency(savings)}</strong>
              <span>annual savings recorded</span>
            </div>
          </div>
          <Button variant="secondary" onClick={() => navigate("/benefits")}>
            View benefits
          </Button>
        </Card>
      </div>
    </>;
}

function StaffDashboard() {
  const { currentUser, opportunities } = useApp();
  const navigate = useNavigate();
  const mine = opportunities.filter(
    (item) => item.submittedBy === currentUser.name
  );
  return <>
      <PageHeader
    eyebrow="Staff portal"
    title="My Dashboard"
    subtitle="Track your improvement requests and submit new opportunities to the AI Foundry."
    actions={<Button icon={Plus} onClick={() => navigate("/submit")}>
            Submit an Idea
          </Button>}
  />
      <div className="stats-grid three">
        <StatCard
    label="Total submissions"
    value={mine.length}
    detail="All your opportunities"
    icon={Network}
    tone="blue"
  />
        <StatCard
    label="Under review"
    value={mine.filter((item) => item.status === "Under Review").length}
    detail={`${mine.filter((item) => item.status === "Submitted").length} awaiting initial review`}
    icon={Clock3}
    tone="amber"
  />
        <StatCard
    label="Approved"
    value={mine.filter((item) => item.status === "Approved").length}
    detail="Moved into delivery"
    icon={CheckCircle2}
    tone="green"
  />
      </div>
      <Card>
        <div className="card-header">
          <div>
            <h2>Recent opportunities</h2>
            <p>Your latest improvement requests and their current status</p>
          </div>
          <button
    className="text-button"
    onClick={() => navigate("/opportunities")}
  >
            View all <ArrowRight size={15} />
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Opportunity Title</th>
                <th>Department</th>
                <th>Submission date</th>
                <th>Current status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {mine.slice(0, 5).map((item) => <tr
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
    </>;
}

function EngineerDashboard() {
  const { projects, benefits } = useApp();
  const navigate = useNavigate();
  const active = projects.filter((item) => item.status === "In Progress");
  const planned = projects.filter((item) => item.status === "Planned");
  const completed = projects.filter((item) => item.status === "Completed");
  const projectBenefits = benefits.filter(
    (item) => projects.some((project) => project.id === item.projectId)
  );
  return <>
      <PageHeader
    eyebrow="Engineer workspace"
    title="Project Delivery Dashboard"
    subtitle="View approved projects, record progress and keep delivery on track."
    actions={<Button onClick={() => navigate("/pipeline")}>
            View Project Pipeline <ArrowRight size={16} />
          </Button>}
  />
      <div className="stats-grid four">
        <StatCard
    label="Approved projects"
    value={projects.length}
    detail="Current delivery portfolio"
    icon={BriefcaseBusiness}
    tone="blue"
  />
        <StatCard
    label="In progress"
    value={active.length}
    detail="Currently in delivery"
    icon={Gauge}
    tone="violet"
  />
        <StatCard
    label="Planned"
    value={planned.length}
    detail="Ready to begin"
    icon={CalendarDays}
    tone="amber"
  />
        <StatCard
    label="Completed"
    value={completed.length}
    detail="Delivered projects"
    icon={CheckCircle2}
    tone="green"
  />
      </div>
      <div className="dashboard-grid">
        <Card className="span-2">
          <div className="card-header">
            <div>
              <h2>Project Pipeline</h2>
              <p>Approved delivery work and upcoming deadlines</p>
            </div>
            <button
    className="text-button"
    onClick={() => navigate("/pipeline")}
  >
              View all <ArrowRight size={15} />
            </button>
          </div>
          <div className="table-wrap">
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
            <BarChart3 size={20} />
            <div>
              <strong>{projectBenefits.length}</strong>
              <span>benefit measures recorded</span>
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
  if (role === "Staff") return <StaffDashboard />;
  if (role === "AI Foundry Engineer") return <EngineerDashboard />;
  return <ManagerDashboard />;
}
