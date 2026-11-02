import { useState } from "react";
import {
  Filter,
  Plus,
  Search
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { departments } from "../data/options";
import {
  Button,
  EmptyState,
  PriorityBadge,
  StatusBadge,
  TableAction
} from "../components/ui";

export function OpportunitiesPage() {
  const { currentUser, role, opportunities } = useApp();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [department, setDepartment] = useState("All");
  const [priority, setPriority] = useState("All");
  const isStaff = role === "Staff";
  const isEngineer = role === "AI Foundry Engineer";
  const statusOptions = isEngineer ? ["All", "Approved"] : ["All", "Submitted", "Under Review", "Approved", "Rejected"];
  const filtered = opportunities.filter((item) => {
    if (isStaff && item.submittedBy !== currentUser.name) return false;
    if (isEngineer && item.status !== "Approved") return false;
    if (search && !`${item.id} ${item.title} ${item.department} ${item.submittedBy}`.toLowerCase().includes(search.toLowerCase()))
      return false;
    if (status !== "All" && item.status !== status) return false;
    if (department !== "All" && item.department !== department) return false;
    if (priority !== "All" && item.priority !== priority) return false;
    return true;
  });
  return <div className="opportunity-workspace">
      <section className="opportunity-masthead">
        <div className="masthead-code">
          OPP / {isStaff ? "MINE" : isEngineer ? "APPROVED" : "ALL"}
        </div>
        <div className="masthead-copy">
          <span className="eyebrow">
            {isStaff ? "Staff opportunity record" : isEngineer ? "Approved opportunity record" : "University opportunity queue"}
          </span>
          <h1>
            {isStaff ? "My Opportunities" : isEngineer ? "Approved Opportunities" : "All Opportunities"}
          </h1>
          <p>
            {isStaff ? "A live record of your submitted ideas, review decisions and delivery progress." : isEngineer ? "View approved requests and the context behind project delivery." : "Assess, prioritise and progress improvement opportunities from across LSBU."}
          </p>
        </div>
        <div className="masthead-ledger">
          <div>
            <strong>{filtered.length}</strong>
            <span>In view</span>
          </div>
          <div>
            <strong>
              {filtered.filter((item) => item.status === "Under Review").length}
            </strong>
            <span>In review</span>
          </div>
          <div>
            <strong>
              {filtered.filter((item) => item.status === "Approved").length}
            </strong>
            <span>Approved</span>
          </div>
        </div>
        {isStaff && <Button icon={Plus} onClick={() => navigate("/submit")}>
            Submit an Idea
          </Button>}
      </section>

      <section className="opportunity-query">
        <label className="work-search">
          <Search size={16} />
          <input
    value={search}
    onChange={(event) => setSearch(event.target.value)}
    placeholder="Search title or opportunity ID"
  />
          <span>⌘ K</span>
        </label>
        <div className="status-tabs" aria-label="Filter by status">
          {statusOptions.map((item) => <button
    key={item}
    className={status === item ? "active" : ""}
    onClick={() => setStatus(item)}
  >
              {item}
              <span>
                {opportunities.filter(
    (opportunity) => (!isStaff || opportunity.submittedBy === currentUser.name) && (item === "All" || opportunity.status === item)
  ).length}
              </span>
            </button>)}
        </div>
        {!isStaff && <div className="query-selects">
            <Filter size={15} />
            <select
    value={department}
    onChange={(event) => setDepartment(event.target.value)}
  >
              <option>All</option>
              {departments.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select
    value={priority}
    onChange={(event) => setPriority(event.target.value)}
  >
              <option>All</option>
              {["High", "Medium", "Low", "Not set"].map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>}
      </section>

      {filtered.length ? <section className="opportunity-worklist">
          <div className="worklist-heading">
            <span>Index</span>
            <span>Status</span>
            <span>Opportunity</span>
            <span>{isStaff ? "Submitted" : "Owner"}</span>
            <span>Priority</span>
            <span />
          </div>
          {filtered.map((item, index) => <button
    className="opportunity-row"
    key={item.id}
    onClick={() => navigate(`/opportunities/${item.id}`)}
  >
              <span className="row-index">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="row-status">
                <StatusBadge status={item.status} />
              </span>
              <span className="row-subject">
                <span className="mono">{item.id}</span>
                <strong>{item.title}</strong>
                <small>
                  {item.department} · {item.category}
                </small>
              </span>
              <span className="row-owner">
                <strong>
                  {isStaff ? item.submittedDate : item.submittedBy}
                </strong>
                <small>{isStaff ? item.department : item.submittedDate}</small>
              </span>
              <PriorityBadge priority={item.priority} />
              <TableAction children="Open" />
            </button>)}
        </section> : <div className="worklist-empty">
          <EmptyState
    title="No opportunities in this view"
    text="Adjust the search or filters to return to the opportunity queue."
  />
        </div>}
    </div>;
}
