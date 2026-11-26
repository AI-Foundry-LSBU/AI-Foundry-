import {
  createContext,
  useEffect,
  useContext,
  useMemo,
  useState,
} from "react";
import {
  initialBenefits,
  initialOpportunities,
  initialProjects,
} from "../data/mockData";
import { endSession, getCurrentSession, signInWithPassword } from '../data/authApi';
import { clearSessionToken } from '../data/apiRequest';

const AppContext = createContext(null);
function AppProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [authAttempt, setAuthAttempt] = useState(0);
  const role = currentUser?.role ?? 'Staff';
  useEffect(() => {
    const controller = new AbortController();
    setAuthLoading(true);
    setAuthError('');
    sessionStorage.removeItem('ai-foundry.demoEmail');
    getCurrentSession(controller.signal).then(
      (user) => { if (!controller.signal.aborted) setCurrentUser(user); },
      (error) => {
        if (controller.signal.aborted) return;
        setCurrentUser(null);
        if (error.status !== 401) setAuthError(error.message);
      }
    ).finally(() => { if (!controller.signal.aborted) setAuthLoading(false); });
    return () => controller.abort();
  }, [authAttempt]);
  useEffect(() => {
    const clear = () => { clearSessionToken(); setCurrentUser(null); };
    window.addEventListener('ai-foundry:session-ended', clear);
    return () => window.removeEventListener('ai-foundry:session-ended', clear);
  }, []);
  const [opportunities, setOpportunities] = useState(initialOpportunities);
  const [projects, setProjects] = useState(initialProjects);
  const [benefits, setBenefits] = useState(initialBenefits);
  const signIn = async (email, password) => {
    const user = await signInWithPassword(email, password);
    setCurrentUser(user);
    return user;
  };
  const signOut = async () => {
    try { await endSession(); } catch (error) { if (error.status !== 401) throw error; }
    clearSessionToken();
    setCurrentUser(null);
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
      authLoading,
      authError,
      retrySession: () => setAuthAttempt((value) => value + 1),
      signIn,
      signOut,
      role,
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
    [currentUser, role, opportunities, projects, benefits, authLoading, authError]
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
