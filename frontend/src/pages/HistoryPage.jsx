import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { useDeliveryProjects } from "../data/useDeliveryProjects";
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  StatusBadge
} from "../components/ui";

export function HistoryPage() {
  const { role } = useApp();
  const navigate = useNavigate();
  const delivery = useDeliveryProjects();
  if (role === "Staff") return <EmptyState
    title="Access restricted"
    text="Project history is available to the AI Foundry team."
    action={<Button onClick={() => navigate("/opportunities")}>My Opportunities</Button>}
  />;
  if (delivery.loading) return <div role="status"><EmptyState title="Loading history…" /></div>;
  if (delivery.error) return <div role="alert">
    <EmptyState title="Could not load history" text={delivery.error.message} action={<Button onClick={delivery.retry}>Try again</Button>} />
  </div>;
  const completed = delivery.data.filter((project) => project.status === "Completed");
  return <>
    <PageHeader
      title="History"
      subtitle="Completed projects stay here. Their status cannot be changed."
    />
    {completed.length === 0 ? <EmptyState
      title="No completed projects yet"
      text="When a project is marked Completed, it leaves Project Delivery and appears here."
      action={<Button variant="secondary" onClick={() => navigate("/pipeline")}>Project Delivery</Button>}
    /> : <Card className="table-card">
      <div className="table-wrap fit-table">
        <table>
          <thead>
            <tr>
              <th>Project</th>
              <th>Department</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {completed.map((project) => <tr key={project.id} onClick={() => navigate(`/projects/${project.id}`)}>
              <td>
                <div className="title-cell">
                  <strong>{project.title}</strong>
                  <span>{project.id}</span>
                </div>
              </td>
              <td>{project.department}</td>
              <td>
                <StatusBadge status="Completed" />
              </td>
              <td>
                {role === "Digital Project Manager" && <button
                  type="button"
                  className="text-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    navigate(`/opportunities/${project.opportunityId}`);
                  }}
                >
                  Opportunity history
                </button>}
              </td>
            </tr>)}
          </tbody>
        </table>
      </div>
      <p className="list-foot">
        {completed.length} completed {completed.length === 1 ? "project" : "projects"}.
      </p>
    </Card>}
  </>;
}
