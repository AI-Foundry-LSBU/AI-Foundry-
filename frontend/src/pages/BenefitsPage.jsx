import { useState } from "react";
import {
  BriefcaseBusiness,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Filter,
  Plus
} from "lucide-react";
import { useApp } from "../context/AppContext";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  StatCard,
  formatCurrency
} from "../components/ui";

export function BenefitsPage() {
  const { role, benefits, projects, addBenefit, updateBenefit } = useApp();
  const [open, setOpen] = useState(false);
  const [editingBenefit, setEditingBenefit] = useState(null);
  const [projectFilter, setProjectFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("All");
  const [form, setForm] = useState({
    projectId: "",
    category: "",
    description: "",
    measurement: "",
    estimated: "",
    actual: "",
    unit: "",
    date: ( new Date()).toISOString().slice(0, 10),
    notes: ""
  });
  if (role === "Staff")
    return <EmptyState
      title="Access restricted"
      text="Benefits Reporting is available to the AI Foundry team."
    />;
  const visibleProjects = projects;
  const scopedBenefits = benefits;
  const dateOptions = Array.from(
    new Set(
      scopedBenefits.map((item) => item.date.split(" ").slice(1).join(" "))
    )
  );
  const filteredBenefits = scopedBenefits.filter((item) => {
    if (projectFilter !== "All" && item.projectId !== projectFilter)
      return false;
    if (categoryFilter !== "All" && item.category !== categoryFilter)
      return false;
    if (dateFilter !== "All" && !item.date.includes(dateFilter)) return false;
    return true;
  });
  const hours = filteredBenefits.filter((item) => item.unit === "Hours/month").reduce((sum, item) => sum + item.actual, 0);
  const savings = filteredBenefits.filter((item) => item.unit === "GBP/year").reduce((sum, item) => sum + item.actual, 0);
  const benefitProjects = new Set(
    filteredBenefits.map((item) => item.projectId)
  ).size;
  const categoryCounts = [
    "Efficiency",
    "Financial",
    "Service",
    "Risk",
    "Data",
    "Strategic"
  ].map((category) => ({
    category,
    count: filteredBenefits.filter((item) => item.category === category).length
  }));
  const timeBenefits = [...filteredBenefits].filter((item) => item.unit === "Hours/month").sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const maxTimeValue = Math.max(...timeBenefits.map((item) => item.actual), 1);
  const chartPoints = timeBenefits.map((item, index) => {
    const x = timeBenefits.length === 1 ? 300 : index / (timeBenefits.length - 1) * 600;
    const y = 165 - item.actual / maxTimeValue * 120;
    return {
      x,
      y,
      label: item.date.split(" ").slice(0, 2).join(" "),
      value: item.actual
    };
  });
  const linePath = chartPoints.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
  const areaPath = chartPoints.length ? `${linePath} L${chartPoints.at(-1)?.x},190 L${chartPoints[0].x},190 Z` : "";
  const save = (event) => {
    event.preventDefault();
    const data = {
      projectId: form.projectId,
      category: form.category,
      description: form.description,
      measurement: form.measurement,
      estimated: Number(form.estimated),
      actual: Number(form.actual),
      unit: form.unit,
      date: new Date(form.date).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric"
      }),
      notes: form.notes
    };
    if (editingBenefit) updateBenefit(editingBenefit, data);
    else addBenefit(data);
    setOpen(false);
    setEditingBenefit(null);
  };
  const openBenefitForm = (benefit) => {
    if (role !== "Digital Project Manager") return;
    if (benefit) {
      const parsedDate = new Date(benefit.date);
      setForm({
        projectId: benefit.projectId,
        category: benefit.category,
        description: benefit.description,
        measurement: benefit.measurement,
        estimated: String(benefit.estimated),
        actual: String(benefit.actual),
        unit: benefit.unit,
        date: Number.isNaN(parsedDate.getTime()) ? ( new Date()).toISOString().slice(0, 10) : parsedDate.toISOString().slice(0, 10),
        notes: benefit.notes ?? ""
      });
      setEditingBenefit(benefit.id);
    } else {
      setForm({
        projectId: "",
        category: "",
        description: "",
        measurement: "",
        estimated: "",
        actual: "",
        unit: "",
        date: ( new Date()).toISOString().slice(0, 10),
        notes: ""
      });
      setEditingBenefit(null);
    }
    setOpen(true);
  };
  return <>
      <PageHeader
    eyebrow="Impact and value"
    title="Benefits Reporting"
    subtitle="Measure and report the impact of AI Foundry projects."
    actions={role === "Digital Project Manager" ? <Button icon={Plus} onClick={() => openBenefitForm()}>
              Record Benefit
            </Button> : void 0}
  />
      <div className="stats-grid four">
        <StatCard
    label="Projects with benefits"
    value={benefitProjects}
    detail="Across the portfolio"
    icon={BriefcaseBusiness}
    tone="blue"
  />
        <StatCard
    label="Actual hours saved"
    value={`${hours} / mo`}
    detail="From recorded benefit measures"
    icon={Clock3}
    tone="violet"
  />
        <StatCard
    label="Financial savings"
    value={formatCurrency(savings)}
    detail="Annual actual saving"
    icon={CircleDollarSign}
    tone="green"
  />
        <StatCard
    label="Completed projects"
    value={visibleProjects.filter((item) => item.status === "Completed").length}
    detail="Ready for benefits review"
    icon={CheckCircle2}
    tone="amber"
  />
      </div>
      <Card className="benefit-filter-card">
        <div className="filters">
          <div className="filter-heading">
            <Filter size={16} />
            <div>
              <strong>Filter benefits</strong>
              <span>Dashboard figures and charts update together</span>
            </div>
          </div>
          <div className="filter-group">
            <select
    value={projectFilter}
    onChange={(event) => setProjectFilter(event.target.value)}
  >
              <option value="All">All projects</option>
              {visibleProjects.map((item) => <option key={item.id} value={item.id}>
                  {item.title}
                </option>)}
            </select>
            <select
    value={categoryFilter}
    onChange={(event) => setCategoryFilter(event.target.value)}
  >
              <option value="All">All categories</option>
              {[
    "Efficiency",
    "Financial",
    "Service",
    "Risk",
    "Data",
    "Strategic"
  ].map((item) => <option key={item}>{item}</option>)}
            </select>
            <select
    value={dateFilter}
    onChange={(event) => setDateFilter(event.target.value)}
  >
              <option value="All">All dates</option>
              {dateOptions.map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
        </div>
      </Card>
      <div className="benefits-charts">
        <Card>
          <div className="card-header">
            <div>
              <h2>Benefits by category</h2>
              <p>Number of recorded benefit measures</p>
            </div>
          </div>
          <div className="vertical-chart">
            {categoryCounts.map((item) => <div key={item.category}>
                <span>{item.count}</span>
                <i style={{ height: `${Math.max(item.count * 42, 8)}px` }} />
                <small>{item.category}</small>
              </div>)}
          </div>
        </Card>
        <Card>
          <div className="card-header">
            <div>
              <h2>Benefits over time</h2>
              <p>Recorded actual hours saved per month</p>
            </div>
            <span className="chart-legend">
              <i /> Hours/month
            </span>
          </div>
          <div className="line-chart">
            <svg viewBox="0 0 600 190" preserveAspectRatio="none">
              {areaPath && <path className="area" d={areaPath} />}
              {linePath && <path className="line" d={linePath} />}
              {chartPoints.map((point) => <circle
    key={`${point.x}-${point.y}`}
    cx={point.x}
    cy={point.y}
    r="5"
    className="chart-point"
  />)}
            </svg>
            <div className="axis-labels">
              {chartPoints.length ? chartPoints.map((point) => <span key={`${point.label}-${point.value}`}>
                    {point.label} · {point.value}
                  </span>) : <span>No recorded hours for these filters</span>}
            </div>
          </div>
        </Card>
      </div>
      <Card className="table-card">
        <div className="card-header">
          <div>
            <h2>Recorded benefits</h2>
            <p>Estimated and actual measures are shown separately by unit</p>
          </div>
        </div>
        {filteredBenefits.length ? <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Benefit category</th>
                  <th>Measurement</th>
                  <th>Estimated value</th>
                  <th>Actual value</th>
                  <th>Unit</th>
                  <th>Date recorded</th>
                  {role === "Digital Project Manager" && <th>Action</th>}
                </tr>
              </thead>
              <tbody>
                {filteredBenefits.map((item) => <tr key={item.id}>
                    <td>
                      <strong>{item.project}</strong>
                    </td>
                    <td>
                      <span className="category-pill">{item.category}</span>
                    </td>
                    <td>{item.measurement}</td>
                    <td>{item.estimated.toLocaleString()}</td>
                    <td>
                      <strong>{item.actual.toLocaleString()}</strong>
                    </td>
                    <td>{item.unit}</td>
                    <td>{item.date}</td>
                    {role === "Digital Project Manager" && <td>
                        <button
    className="text-button"
    onClick={() => openBenefitForm(item)}
  >
                          Edit
                        </button>
                      </td>}
                  </tr>)}
              </tbody>
            </table>
          </div> : <EmptyState
    title="No benefits match these filters"
    text="Change the selected project, category or date to view other recorded benefits."
  />}
      </Card>
      {open && <Modal
    title={editingBenefit ? "Update benefit" : "Record a benefit"}
    onClose={() => setOpen(false)}
  >
          <form className="modal-form" onSubmit={save}>
            <div className="modal-grid">
              <Field label="Project" required>
                <select
    required
    value={form.projectId}
    onChange={(event) => setForm({ ...form, projectId: event.target.value })}
  >
                  <option value="">Select a project</option>
                  {visibleProjects.map((item) => <option key={item.id} value={item.id}>
                      {item.title}
                    </option>)}
                </select>
              </Field>
              <Field label="Benefit category" required>
                <select
    required
    value={form.category}
    onChange={(event) => setForm({ ...form, category: event.target.value })}
  >
                  <option value="">Select category</option>
                  {[
    "Efficiency",
    "Financial",
    "Service",
    "Risk",
    "Data",
    "Strategic"
  ].map((item) => <option key={item}>{item}</option>)}
                </select>
              </Field>
              <Field label="Benefit description" required>
                <textarea
    rows={3}
    required
    value={form.description}
    onChange={(event) => setForm({ ...form, description: event.target.value })}
    placeholder="Describe the benefit delivered..."
  />
              </Field>
              <Field label="Measurement" required>
                <input
    required
    value={form.measurement}
    onChange={(event) => setForm({ ...form, measurement: event.target.value })}
    placeholder="e.g. Staff hours saved per month"
  />
              </Field>
              <Field label="Estimated value" required>
                <input
    type="number"
    required
    value={form.estimated}
    onChange={(event) => setForm({ ...form, estimated: event.target.value })}
  />
              </Field>
              <Field label="Actual value" required>
                <input
    type="number"
    required
    value={form.actual}
    onChange={(event) => setForm({ ...form, actual: event.target.value })}
  />
              </Field>
              <Field label="Unit" required>
                <select
    required
    value={form.unit}
    onChange={(event) => setForm({ ...form, unit: event.target.value })}
  >
                  <option value="">Select unit</option>
                  <option>Hours/month</option>
                  <option>GBP/year</option>
                  <option>Percent</option>
                  <option>Days</option>
                  <option>Cases/month</option>
                </select>
              </Field>
              <Field label="Date recorded" required>
                <input
    type="date"
    required
    value={form.date}
    onChange={(event) => setForm({ ...form, date: event.target.value })}
  />
              </Field>
              <Field label="Notes" helper="Optional supporting context.">
                <textarea
    rows={3}
    value={form.notes}
    onChange={(event) => setForm({ ...form, notes: event.target.value })}
    placeholder="Add validation notes, assumptions or follow-up actions..."
  />
              </Field>
            </div>
            <div className="modal-actions">
              <Button
    type="button"
    variant="secondary"
    onClick={() => setOpen(false)}
  >
                Cancel
              </Button>
              <Button type="submit">
                {editingBenefit ? "Update Benefit" : "Save Benefit"}
              </Button>
            </div>
          </form>
        </Modal>}
    </>;
}
