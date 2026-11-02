import { useState } from "react";
import {
  CalendarDays,
  Network,
  Plus,
  UsersRound
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  StatusBadge
} from "../components/ui";

export function HackathonsPage() {
  const { role, opportunities, addOpportunity } = useApp();
  const navigate = useNavigate();
  const [moved, setMoved] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [candidateHackathon, setCandidateHackathon] = useState(
    null
  );
  const [detailHackathon, setDetailHackathon] = useState(null);
  const [hackathonForm, setHackathonForm] = useState({
    name: "",
    description: "",
    date: ""
  });
  const [candidateTitle, setCandidateTitle] = useState("");
  const [hackathons, setHackathons] = useState([
    {
      name: "AI for Student Success",
      date: "18 Mar 2025",
      description: "Cross-university ideation focused on student support and retention.",
      status: "Completed",
      ideas: ["Early engagement signal", "Assessment feedback assistant"]
    },
    {
      name: "Smarter Campus Operations",
      date: "21 May 2025",
      description: "Improving campus services, facilities and day-to-day operations.",
      status: "In review",
      ideas: ["Room utilisation insights", "Facilities request triage"]
    },
    {
      name: "Research Acceleration Lab",
      date: "16 Jul 2025",
      description: "Exploring practical AI support for researchers and professional teams.",
      status: "Planned",
      ideas: []
    }
  ]);
  if (role !== "Digital Project Manager")
    return <EmptyState
      title="Access restricted"
      text="Hackathon management is available to Digital Project Managers."
      action={<Button onClick={() => navigate("/dashboard")}>
            Return to dashboard
          </Button>}
    />;
  const moveToBacklog = (idea, hackathon) => {
    const alreadyExists = opportunities.some(
      (item) => item.title.toLowerCase() === idea.toLowerCase()
    );
    if (!alreadyExists)
      addOpportunity({
        title: idea,
        department: hackathon === "Smarter Campus Operations" ? "Estates & Facilities" : "Student Services",
        category: "AI",
        problem: `This opportunity was identified during the ${hackathon} hackathon and requires structured discovery with relevant teams.`,
        improvement: "Assess the idea through the standard AI Foundry opportunity process and define a practical, user-centred delivery approach.",
        submittedBy: "Hackathon programme"
      });
    setMoved((current) => [...current, idea]);
  };
  const createHackathon = (event) => {
    event.preventDefault();
    setHackathons((current) => [
      ...current,
      {
        name: hackathonForm.name,
        description: hackathonForm.description,
        date: new Date(hackathonForm.date).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric"
        }),
        status: "Planned",
        ideas: []
      }
    ]);
    setHackathonForm({ name: "", description: "", date: "" });
    setCreateOpen(false);
  };
  const addCandidate = (event) => {
    event.preventDefault();
    if (!candidateHackathon || !candidateTitle.trim()) return;
    setHackathons(
      (current) => current.map(
        (hackathon) => hackathon.name === candidateHackathon && !hackathon.ideas.some(
          (idea) => idea.toLowerCase() === candidateTitle.trim().toLowerCase()
        ) ? {
          ...hackathon,
          ideas: [...hackathon.ideas, candidateTitle.trim()]
        } : hackathon
      )
    );
    setCandidateTitle("");
    setCandidateHackathon(null);
  };
  const selectedHackathon = hackathons.find(
    (item) => item.name === detailHackathon
  );
  return <>
      <PageHeader
    eyebrow="Innovation programme"
    title="Hackathons"
    subtitle="Manage potential AI Foundry projects identified during hackathons."
    actions={<Button icon={Plus} onClick={() => setCreateOpen(true)}>
            Create Hackathon
          </Button>}
  />
      <div className="hackathon-grid">
        {hackathons.map((hackathon) => <Card className="hackathon-card" key={hackathon.name}>
            <div className="hackathon-top">
              <div className="hackathon-icon">
                <UsersRound size={20} />
              </div>
              <StatusBadge status={hackathon.status} />
            </div>
            <h2>{hackathon.name}</h2>
            <p>{hackathon.description}</p>
            <div className="hackathon-meta">
              <span>
                <CalendarDays size={15} />
                {hackathon.date}
              </span>
              <span>
                <Network size={15} />
                {hackathon.ideas.length} candidate opportunities
              </span>
            </div>
            {hackathon.ideas.length > 0 && <div className="idea-list">
                {hackathon.ideas.map((idea) => <div key={idea}>
                    <span>{idea}</span>
                    <button
    disabled={moved.includes(idea)}
    onClick={() => moveToBacklog(idea, hackathon.name)}
  >
                      {moved.includes(idea) ? "Moved to backlog" : "Move to backlog"}
                    </button>
                  </div>)}
              </div>}
            <Button
    variant="secondary"
    onClick={() => setDetailHackathon(hackathon.name)}
  >
              View details
            </Button>
            <button
    className="text-button hackathon-add"
    onClick={() => setCandidateHackathon(hackathon.name)}
  >
              <Plus size={14} /> Add candidate opportunity
            </button>
          </Card>)}
      </div>
      {createOpen && <Modal title="Create a hackathon" onClose={() => setCreateOpen(false)}>
          <form className="modal-form" onSubmit={createHackathon}>
            <div className="modal-grid">
              <Field label="Hackathon title" required>
                <input
    required
    value={hackathonForm.name}
    onChange={(event) => setHackathonForm({
      ...hackathonForm,
      name: event.target.value
    })}
    placeholder="e.g. Smarter Student Support"
  />
              </Field>
              <Field label="Date" required>
                <input
    required
    type="date"
    value={hackathonForm.date}
    onChange={(event) => setHackathonForm({
      ...hackathonForm,
      date: event.target.value
    })}
  />
              </Field>
              <Field label="Description" required>
                <textarea
    required
    rows={4}
    value={hackathonForm.description}
    onChange={(event) => setHackathonForm({
      ...hackathonForm,
      description: event.target.value
    })}
    placeholder="Describe the discovery theme and intended participants..."
  />
              </Field>
            </div>
            <div className="modal-actions">
              <Button
    type="button"
    variant="secondary"
    onClick={() => setCreateOpen(false)}
  >
                Cancel
              </Button>
              <Button type="submit">Create Hackathon</Button>
            </div>
          </form>
        </Modal>}
      {candidateHackathon && <Modal
    title="Add candidate opportunity"
    onClose={() => setCandidateHackathon(null)}
  >
          <form className="modal-form" onSubmit={addCandidate}>
            <div className="modal-context">
              <span>Hackathon</span>
              <strong>{candidateHackathon}</strong>
              <p>
                Add a discovery candidate. It can later be moved into the main
                opportunity backlog for assessment.
              </p>
            </div>
            <Field label="Candidate title" required>
              <input
    required
    value={candidateTitle}
    onChange={(event) => setCandidateTitle(event.target.value)}
    placeholder="e.g. Student support case summarisation"
  />
            </Field>
            <div className="modal-actions">
              <Button
    type="button"
    variant="secondary"
    onClick={() => setCandidateHackathon(null)}
  >
                Cancel
              </Button>
              <Button type="submit">Add Candidate</Button>
            </div>
          </form>
        </Modal>}
      {selectedHackathon && <Modal
    title={selectedHackathon.name}
    onClose={() => setDetailHackathon(null)}
  >
          <div className="confirm-content">
            <div className="modal-context">
              <span>
                {selectedHackathon.date} · {selectedHackathon.status}
              </span>
              <p>{selectedHackathon.description}</p>
            </div>
            <div className="detail-candidate-list">
              {selectedHackathon.ideas.length ? selectedHackathon.ideas.map((idea) => <div key={idea}>
                    <span>{idea}</span>
                    <Button
    variant="secondary"
    disabled={moved.includes(idea) || opportunities.some(
      (item) => item.title.toLowerCase() === idea.toLowerCase()
    )}
    onClick={() => moveToBacklog(idea, selectedHackathon.name)}
  >
                      {moved.includes(idea) || opportunities.some(
    (item) => item.title.toLowerCase() === idea.toLowerCase()
  ) ? "In Backlog" : "Move to Backlog"}
                    </Button>
                  </div>) : <EmptyState
    title="No candidates yet"
    text="Add a candidate opportunity to this hackathon."
  />}
            </div>
            <div className="modal-actions">
              <Button
    variant="secondary"
    onClick={() => setDetailHackathon(null)}
  >
                Close
              </Button>
              <Button onClick={() => navigate("/opportunities")}>
                View Opportunity Backlog
              </Button>
            </div>
          </div>
        </Modal>}
    </>;
}
