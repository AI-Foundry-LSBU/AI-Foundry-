import {
  createContext,
  useContext,
  useMemo,
  useState,
} from "react";
import {
  initialBenefits,
  initialOpportunities,
  initialProjects,
} from "../data/mockData";

const AppContext = createContext(null);
const demoEmailKey = "ai-foundry.demoEmail";
const demoNames = {
  "staff@example.com": "Demo Staff",
  "staff2@example.com": "Second Demo Staff",
  "manager@example.com": "Demo Manager",
  "team@example.com": "Demo Engineer",
};

const demoRoles = {
  "manager@example.com": "Digital Project Manager",
  "team@example.com": "AI Foundry Engineer",
};

function demoUser(email) {
  const localPart = email.split("@")[0] || "sarah.smith";
  const name = localPart.split(/[._-]/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
  const resolvedName = demoNames[email] ?? (name || "Sarah Smith");
  return {
    name: resolvedName,
    email,
    role: demoRoles[email] ?? "Staff",
    initials: resolvedName.split(" ").map((part) => part[0]).join("").slice(0, 2),
    team: demoRoles[email] ? "AI Foundry" : resolvedName === "Sarah Smith" ? "Student Services" : "LSBU Staff"
  };
}

function AppProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    const email = sessionStorage.getItem(demoEmailKey);
    return email ? demoUser(email) : null;
  });
  const [role, setRole] = useState(currentUser?.role ?? "Staff");
  const [opportunities, setOpportunities] = useState(initialOpportunities);
  const [projects, setProjects] = useState(initialProjects);
  const [benefits, setBenefits] = useState(initialBenefits);
  const signIn = (email) => {
    const normalizedEmail = email.trim().toLowerCase();
    sessionStorage.setItem(demoEmailKey, normalizedEmail);
    const user = demoUser(normalizedEmail);
    setCurrentUser(user);
    setRole(user.role);
    return user;
  };
  const signOut = () => {
    sessionStorage.removeItem(demoEmailKey);
    setCurrentUser(null);
    setRole("Staff");
  };
  const assessOpportunity = (id, priority, assessment, comments, category) => {
    if (role !== "Digital Project Manager") return false;
    setOpportunities(
      (current) => current.map(
        (item) => item.id === id ? {
          ...item,
          priority,
          category: category ?? item.category,
          assessment,
          assessmentComments: comments,
          status: item.status === "Submitted" ? "Under Review" : item.status
        } : item
      )
    );
    return true;
  };
  const decideOpportunity = (id, decision, reason) => {
    if (role !== "Digital Project Manager") return false;
    if (decision !== "Approved" && projects.some((project) => project.opportunityId === id))
      return false;
    setOpportunities(
      (current) => current.map(
        (item) => item.id === id ? { ...item, status: decision, decisionReason: reason } : item
      )
    );
    return true;
  };
  const createProject = (opportunityId, startDate, targetDate) => {
    if (role !== "Digital Project Manager") return null;
    const opportunity = opportunities.find((item) => item.id === opportunityId);
    if (!opportunity || opportunity.status !== "Approved" || projects.some((project2) => project2.opportunityId === opportunityId))
      return null;
    const nextId = Math.max(
      ...projects.map((project2) => Number(project2.id.split("-").at(-1))),
      15
    ) + 1;
    const project = {
      id: `PRJ-${String(nextId).padStart(3, "0")}`,
      opportunityId,
      title: opportunity.title,
      department: opportunity.department,
      description: opportunity.improvement,
      priority: opportunity.priority,
      status: "Approved",
      startDate: startDate ? new Date(startDate).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric"
      }) : "Not scheduled",
      targetDate: targetDate ? new Date(targetDate).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric"
      }) : "Not scheduled",
      progress: 0,
      notes: "Approved for delivery. Project planning is ready to begin.",
      activity: [
        {
          date: "Today",
          author: "Olivia Bennett",
          text: `Project created from ${opportunity.id} and added to Project Delivery.`
        }
      ]
    };
    setProjects((current) => [project, ...current]);
    return project;
  };
  const updateProject = (id, patch, updateText) => {
    const canUpdate = role === "Digital Project Manager" || role === "AI Foundry Engineer";
    if (!canUpdate) return false;
    const normalizedPatch = patch.status === "Completed" ? { ...patch, progress: 100 } : patch;
    setProjects(
      (current) => current.map(
        (project) => project.id === id ? {
          ...project,
          ...normalizedPatch,
          activity: updateText ? [
            {
              date: "Today",
              author: role === "AI Foundry Engineer" ? "Alex Morgan" : "Olivia Bennett",
              text: updateText
            },
            ...project.activity
          ] : project.activity
        } : project
      )
    );
    return true;
  };
  const addBenefit = (data) => {
    if (role !== "Digital Project Manager") return false;
    const project = projects.find((item) => item.id === data.projectId);
    setBenefits((current) => [
      {
        ...data,
        id: `BEN-${String(current.length + 1).padStart(3, "0")}`,
        project: project?.title ?? "Unknown project"
      },
      ...current
    ]);
    return true;
  };
  const updateBenefit = (id, data) => {
    if (role !== "Digital Project Manager") return false;
    const project = projects.find((item) => item.id === data.projectId);
    setBenefits(
      (current) => current.map(
        (benefit) => benefit.id === id ? {
          ...data,
          id,
          project: project?.title ?? benefit.project
        } : benefit
      )
    );
    return true;
  };
  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(currentUser),
      currentUser,
      signIn,
      signOut,
      role,
      setRole,
      opportunities,
      projects,
      benefits,
      assessOpportunity,
      decideOpportunity,
      createProject,
      updateProject,
      addBenefit,
      updateBenefit
    }),
    [currentUser, role, opportunities, projects, benefits]
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
}
export {
  AppProvider,
  useApp
};
