import { useState } from "react";
import {
  Filter,
  Plus,
  Search
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { getOpportunityDisplayStatus } from "../data/opportunitiesApi";
import { departments, opportunityStatuses } from "../data/options";
import { useOpportunities } from "../data/useOpportunities";
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
  const useLiveList = isStaff || role === currentUser.role;
  const scope = isStaff ? "mine" : isEngineer ? "approved" : "all";
  const live = useOpportunities(useLiveList ? currentUser.email : null, scope);
  if (live.loading) return <div role="status"><EmptyState title="Loading opportunities…" /></div>;
  if (live.error) return <div role="alert">
      <EmptyState
        title={isStaff ? "Could not load your opportunities" : "Could not load opportunities"}
        text={live.error.message}
        action={<Button onClick={live.retry}>Try again</Button>}
      />
    </div>;

  const statusOptions = ["All", ...opportunityStatuses];
  if (useLiveList) statusOptions.push("In Progress", "Testing", "Completed");
  const scoped = useLiveList ? live.data : opportunities.filter((item) => !isEngineer || item.status === "Approved");
  const departmentOptions = Array.from(new Set([
    ...departments, ...scoped.map((item) => item.department),
  ])).sort((a, b) => a.localeCompare(b));
  const searchText = search.trim().toLowerCase();
  const matchesSearch = (item) => !searchText || `${item.id} ${item.title} ${item.department} ${item.submittedBy ?? ""}`.toLowerCase().includes(searchText);
  const matchesDepartment = (item) => department === "All" || item.department === department;
  const matchesPriority = (item) => priority === "All" || item.priority === priority;
  const narrowed = scoped.filter(
    (item) => matchesSearch(item) && matchesDepartment(item) && matchesPriority(item)
  );
  const filtered = narrowed.filter(
    (item) => isEngineer || status === "All" || getOpportunityDisplayStatus(item) === status
  );
  const statusCount = (item) => narrowed.filter(
    (opportunity) => item === "All" || getOpportunityDisplayStatus(opportunity) === item
  ).length;
  const filtersActive = search !== "" || status !== "All" || department !== "All" || priority !== "All";
  const resetFilters = () => {
    setSearch("");
    setStatus("All");
    setDepartment("All");
    setPriority("All");
  };
  return <div className="opportunity-workspace">
      <section className="opportunity-masthead">
        <div className="masthead-copy">
          <h1>
            {isStaff ? "My Opportunities" : isEngineer ? "Approved Opportunities" : "All Opportunities"}
          </h1>
          <p>
            {isStaff ? "Your submitted opportunities, review decisions and delivery progress." : isEngineer ? "Approved opportunities and the context behind project delivery." : "Review, prioritise and progress opportunities from across LSBU."}
          </p>
        </div>
        <div className="masthead-ledger">
          {isEngineer ? <div>
              <strong>{scoped.length}</strong>
              <span>Approved opportunities</span>
            </div> : <>
              <div>
                <strong>{scoped.length}</strong>
                <span>{isStaff ? "Total submitted" : "Total opportunities"}</span>
              </div>
              <div>
                <strong>
                  {scoped.filter((item) => item.status === "Under Review").length}
                </strong>
                <span>Under Review</span>
              </div>
              <div>
                <strong>
                  {scoped.filter((item) => getOpportunityDisplayStatus(item) === "Approved").length}
                </strong>
                <span>Approved</span>
              </div>
            </>}
        </div>
        {isStaff && <Button icon={Plus} onClick={() => navigate("/submit")}>
            Submit Opportunity
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
        </label>
        {!isEngineer && <div className="status-tabs" aria-label="Filter by status">
          {statusOptions.map((item) => <button
    key={item}
    className={status === item ? "active" : ""}
    onClick={() => setStatus(item)}
  >
              {item}
              <span>{statusCount(item)}</span>
            </button>)}
        </div>}
        {!isStaff && <div className="query-selects">
            <Filter size={15} />
            <label>
              Department
              <select
    value={department}
    onChange={(event) => setDepartment(event.target.value)}
    aria-label="Department"
  >
                <option value="All">All departments</option>
                {departmentOptions.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label>
              Priority
              <select
    value={priority}
    onChange={(event) => setPriority(event.target.value)}
    aria-label="Priority"
  >
                <option value="All">All priorities</option>
                {["High", "Medium", "Low", "Not set"].map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <Button variant="secondary" disabled={!filtersActive} onClick={resetFilters}>
              Reset filters
            </Button>
          </div>}
      </section>

      {filtered.length ? <section className="opportunity-worklist">
          <div className="worklist-heading">
            <span>Status</span>
            <span>Opportunity</span>
            <span>{isStaff ? "Submitted" : "Owner"}</span>
            <span>Priority</span>
            <span />
          </div>
          {filtered.map((item) => <button
    className="opportunity-row"
    key={item.id}
    onClick={() => navigate(`/opportunities/${item.id}`)}
  >
              <span className="row-status">
                <StatusBadge status={getOpportunityDisplayStatus(item)} />
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
    title={useLiveList && !scoped.length ? (isEngineer ? "No approved opportunities yet" : "No opportunities yet") : "No opportunities in this view"}
    text={useLiveList && !scoped.length ? (isStaff ? "Submit an opportunity and it will appear here." : isEngineer ? "Opportunities appear here once a manager approves them." : "Submitted opportunities will appear here.") : "Adjust the search or filters to return to the opportunity queue."}
  />
        </div>}
    </div>;
}
