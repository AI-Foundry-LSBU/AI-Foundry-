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
function AppProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState({
    name: "Sarah Smith",
    email: "sarah.smith@lsbu.ac.uk",
    initials: "SS",
    team: "Student Services"
  });
  const [role, setRole] = useState("Staff");
  const [opportunities, setOpportunities] = useState(initialOpportunities);
  const [projects, setProjects] = useState(initialProjects);
  const [benefits, setBenefits] = useState(initialBenefits);
  const signIn = (email) => {
    const localPart = email.split("@")[0] || "sarah.smith";
    const name = localPart.split(/[._-]/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
    const resolvedName = name || "Sarah Smith";
    setCurrentUser({
      name: resolvedName,
      email,
      initials: resolvedName.split(" ").map((part) => part[0]).join("").slice(0, 2),
      team: resolvedName === "Sarah Smith" ? "Student Services" : "LSBU Staff"
    });
    setRole("Staff");
    setIsAuthenticated(true);
  };
  const signOut = () => {
    setRole("Staff");
    setIsAuthenticated(false);
  };
  const addOpportunity = (data) => {
    if (role === "AI Foundry Engineer") return null;
    const next = 27 + opportunities.filter((item) => Number(item.id.split("-").at(-1)) >= 27).length;
    const opportunity = {
      ...data,
      id: `OPP-2025-${String(next).padStart(3, "0")}`,
      submittedBy: data.submittedBy ?? currentUser.name,
      submittedDate: ( new Date()).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric"
      }),
      status: "Submitted",
      priority: "Not set"
    };
    setOpportunities((current) => [opportunity, ...current]);
    return opportunity;
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
          text: `Project created from ${opportunity.id} and added to the delivery pipeline.`
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
      isAuthenticated,
      currentUser,
      signIn,
      signOut,
      role,
      setRole,
      opportunities,
      projects,
      benefits,
      addOpportunity,
      assessOpportunity,
      decideOpportunity,
      createProject,
      updateProject,
      addBenefit,
      updateBenefit
    }),
    [isAuthenticated, currentUser, role, opportunities, projects, benefits]
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
