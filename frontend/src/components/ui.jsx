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
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="page-heading-aside">
        <span>AF / {eyebrow ?? "Workspace"}</span>
        {actions && <div className="page-actions">{actions}</div>}
      </div>
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
        <small>{detail}</small>
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
  formatCurrency
};
