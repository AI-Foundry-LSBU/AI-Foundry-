import {
  BarChart3,
  BriefcaseBusiness,
  ChevronDown,
  ClipboardList,
  Gauge,
  LogOut,
  Menu,
  Network,
  PanelLeftClose,
  PlusCircle,
  UserRound,
  X
} from "lucide-react";
import {
  Navigate,
  NavLink,
  Outlet,
  useLocation,
  useNavigate
} from "react-router-dom";
import { useState } from "react";
import { useApp } from "../context/AppContext";
const staffNav = [
  { to: "/dashboard", label: "Dashboard", icon: Gauge },
  { to: "/submit", label: "Submit Opportunity", icon: PlusCircle },
  { to: "/opportunities", label: "My Opportunities", icon: ClipboardList }
];
const managementNav = [
  { to: "/dashboard", label: "Management Dashboard", icon: Gauge },
  { to: "/opportunities", label: "All Opportunities", icon: ClipboardList },
  { to: "/pipeline", label: "Project Delivery", icon: BriefcaseBusiness },
  { to: "/benefits", label: "Benefits Reporting", icon: BarChart3 }
];
const engineerNav = [
  { to: "/dashboard", label: "Delivery Dashboard", icon: Gauge },
  { to: "/pipeline", label: "Project Delivery", icon: BriefcaseBusiness },
  { to: "/opportunities", label: "Approved Opportunities", icon: ClipboardList },
  { to: "/benefits", label: "Benefits Reporting", icon: BarChart3 }
];
function pageTitle(pathname, role) {
  const [section, id] = pathname.split("/").filter(Boolean);
  if (section === "dashboard") {
    if (role === "Digital Project Manager") return "Management Dashboard";
    if (role === "AI Foundry Engineer") return "Delivery Dashboard";
    return "Dashboard";
  }
  if (section === "submit") return "Submit an Opportunity";
  if (section === "opportunities") {
    if (id) return "Opportunity";
    if (role === "Staff") return "My Opportunities";
    if (role === "AI Foundry Engineer") return "Approved Opportunities";
    return "All Opportunities";
  }
  if (section === "pipeline") return "Project Delivery";
  if (section === "projects") return "Project Details";
  if (section === "benefits") return "Benefits Reporting";
  return "AI Foundry";
}
function Layout() {
  const { isAuthenticated, currentUser, signOut, role, setRole } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isStaff = role === "Staff";
  const isEngineer = role === "AI Foundry Engineer";
  const nav = isStaff ? staffNav : isEngineer ? engineerNav : managementNav;
  const user = role === "Staff" ? currentUser : role === "Digital Project Manager" ? { name: "Olivia Bennett", initials: "OB", team: "AI Foundry" } : { name: "Alex Morgan", initials: "AM", team: "AI Foundry" };
  const currentTitle = pageTitle(location.pathname, role);
  const changeRole = (nextRole) => {
    setRole(nextRole);
    setMobileOpen(false);
    navigate("/dashboard");
  };
  if (!isAuthenticated) return <Navigate to="/signin" replace />;
  return <div className="app-shell">
      <aside className={`sidebar nav-rail ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="brand rail-brand">
          <div className="brand-mark rail-mark">
            <Network size={19} />
          </div>
          <div className="rail-brand-copy">
            <strong>AI Foundry</strong>
            <span>LSBU</span>
          </div>
          <button className="mobile-close" onClick={() => setMobileOpen(false)}>
            <X size={20} />
          </button>
        </div>
        <nav className="rail-nav">
          {nav.map(({ to, label, icon: Icon }) => <NavLink
    key={to}
    to={to}
    title={label}
    aria-label={label}
    onClick={() => setMobileOpen(false)}
    className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}
  >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>)}
        </nav>
        <div className="sidebar-footer rail-footer">
          <PanelLeftClose size={17} />
          <span>LSBU</span>
        </div>
      </aside>
      {mobileOpen && <div className="sidebar-scrim" onClick={() => setMobileOpen(false)} />}
      <div className="app-main">
        <header className="topbar context-bar">
          <div className="topbar-title context-path">
            <button className="menu-button" onClick={() => setMobileOpen(true)}>
              <Menu size={21} />
            </button>
            <span>
              AI Foundry /{" "}
              {isStaff ? "Staff" : isEngineer ? "Delivery" : "Portfolio"}
            </span>
            <strong>{currentTitle}</strong>
          </div>
          <div className="header-tools">
            <label className="role-select">
              <UserRound size={16} />
              <span>View as</span>
              <select
    value={role}
    onChange={(event) => changeRole(event.target.value)}
  >
                <option>Staff</option>
                <option>Digital Project Manager</option>
                <option>AI Foundry Engineer</option>
              </select>
              <ChevronDown size={14} />
            </label>
            <div className="user-info">
              <div className="avatar">{user.initials}</div>
              <div>
                <strong>{user.name}</strong>
                <span>{role}</span>
              </div>
            </div>
            <button
    className="sign-out-button"
    onClick={() => {
      signOut();
      navigate("/signin");
    }}
    aria-label="Sign out"
  >
              <LogOut size={16} />
              <span>Sign out</span>
            </button>
          </div>
        </header>
        <main className="page-container">
          <Outlet />
        </main>
      </div>
    </div>;
}
export { Layout as AppLayout };
