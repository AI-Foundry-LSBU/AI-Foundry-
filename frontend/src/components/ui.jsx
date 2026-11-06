import { ChevronRight, X } from "lucide-react";
function Button({
  children,
  variant = "primary",
  icon: Icon,
  ...props
}) {
  return <button className={`button button-${variant}`} {...props}>
      {Icon && <Icon size={17} />}
      <span>{children}</span>
    </button>;
}
function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions
}) {
  return <div className="page-heading">
      <div className="page-heading-copy">
        {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-heading-aside">
          <div className="page-actions">{actions}</div>
        </div> : null}
    </div>;
}
function Card({
  children,
  className = ""
}) {
  return <section className={`card ${className}`}>{children}</section>;
}
function StatusBadge({
  status
}) {
  return <span
    className={`badge badge-${status.toLowerCase().replaceAll(" ", "-")}`}
  >
      <i />
      {status}
    </span>;
}
function PriorityBadge({ priority }) {
  return <span
    className={`priority priority-${priority.toLowerCase().replaceAll(" ", "-")}`}
  >
      {priority}
    </span>;
}
function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "blue"
}) {
  return <Card className="stat-card">
      <div className={`stat-icon stat-${tone}`}>
        <Icon size={20} />
      </div>
      <div className="stat-content">
        <span>{label}</span>
        <strong>{value}</strong>
        {detail ? <small>{detail}</small> : null}
      </div>
    </Card>;
}
function Field({
  label,
  required,
  helper,
  error,
  children
}) {
  return <label className={`field ${error ? "field-error" : ""}`}>
      <span className="field-label">
        {label}
        {required && <b> *</b>}
      </span>
      {children}
      {error ? <small className="error-text">{error}</small> : helper ? <small>{helper}</small> : null}
    </label>;
}
function EmptyState({
  title,
  text,
  action
}) {
  return <div className="empty-state">
      <div className="empty-mark">AF</div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>;
}
function Modal({
  title,
  children,
  onClose
}) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
    className="modal"
    role="dialog"
    aria-modal="true"
    aria-label={title}
    onMouseDown={(event) => event.stopPropagation()}
  >
        <div className="modal-header">
          <div>
            <span className="eyebrow">AI Foundry</span>
            <h2>{title}</h2>
          </div>
          <button
    className="icon-button"
    onClick={onClose}
    aria-label="Close dialog"
  >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>;
}
function TableAction({ children = "View" }) {
  return <span className="table-action">
      {children}
      <ChevronRight size={15} />
    </span>;
}
function formatCurrency(value) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0
  }).format(value);
}
function formatMeasure(value, unit) {
  const amount = Number(value).toLocaleString("en-GB");
  if (unit === "GBP/year") return `${formatCurrency(value)}/year`;
  if (unit === "Hours/month") return `${amount} hours/month`;
  if (unit === "Percent") return `${amount}%`;
  if (unit === "Days") return `${amount} days`;
  if (unit === "Cases/month") return `${amount} cases/month`;
  return unit ? `${amount} ${unit}` : amount;
}
export {
  Button,
  Card,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  PriorityBadge,
  StatCard,
  StatusBadge,
  TableAction,
  formatCurrency,
  formatMeasure
};
