import { requestJson } from "./apiRequest";
import { deliveryStatusLabels } from "./projectsApi";

const unavailableMessage = "The opportunities API is unavailable. Check that the backend is running and try again.";

const statusLabels = {
  submitted: "Submitted",
  in_assessment: "Under Review",
  approved: "Approved",
  rejected: "Rejected",
  in_progress: "In Progress",
  completed: "Completed",
};

const categoryLabels = {
  ai_assistant: "AI",
  automation: "Automation",
  reporting: "Reporting",
  process_improvement: "Digital Improvement",
  other: "Other",
};

function request(email, path, options) {
  return requestJson(email, path, options, unavailableMessage);
}

function toOpportunity(data) {
  const priority = data.priority ?? data.assessment?.priority;
  const category = data.category ?? data.assessment?.category;
  return {
    ...data,
    status: statusLabels[data.status] ?? data.status,
    deliveryStatus: deliveryStatusLabels[data.deliveryStatus],
    category: categoryLabels[category] ?? "Uncategorised",
    priority: priority ? priority[0].toUpperCase() + priority.slice(1) : "Not set",
    submittedBy: data.submittedBy?.name,
    submittedDate: new Date(data.submittedAt).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    problem: data.problemDescription,
    improvement: data.proposedImprovement,
    decisionReason: data.decision?.reason,
    decisionStatus: statusLabels[data.decision?.decision],
  };
}

export function getOpportunityDisplayStatus({ status, deliveryStatus }) {
  if (status === "Approved" && deliveryStatus && deliveryStatus !== "Not Started") return deliveryStatus;
  return status;
}

async function getOpportunityPages(email, path, signal, status) {
  const query = new URLSearchParams({ pageSize: "100" });
  if (status) query.set("status", status);
  const first = await request(email, `${path}?${query}`, { signal });
  const opportunities = new Map(first.items.map((item) => [item.id, item]));
  // The existing search and status tabs filter the whole list.
  for (let page = 2; page <= Math.ceil(first.total / first.pageSize); page++) {
    query.set("page", page);
    const result = await request(email, `${path}?${query}`, { signal });
    for (const item of result.items) opportunities.set(item.id, item);
  }
  return Array.from(opportunities.values(), toOpportunity);
}

export function getMyOpportunities(email, signal) {
  return getOpportunityPages(email, "/me/opportunities", signal);
}

export function getAllOpportunities(email, signal) {
  return getOpportunityPages(email, "/opportunities", signal);
}

export function getApprovedOpportunities(email, signal) {
  return getOpportunityPages(email, "/opportunities", signal, "approved");
}

export async function getOpportunity(email, id, signal) {
  const data = await request(email, `/opportunities/${encodeURIComponent(id)}`, { signal });
  return toOpportunity(data);
}

export async function deleteOpportunity(email, id) {
  await request(email, `/opportunities/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function submitOpportunity(email, data) {
  return request(email, "/opportunities", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function saveOpportunityAssessment(email, id, { category, priority, ...details }) {
  const data = await request(email, `/opportunities/${encodeURIComponent(id)}/assessment`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...details,
      priority: priority.toLowerCase(),
      category: Object.keys(categoryLabels).find((key) => categoryLabels[key] === category),
    }),
  });
  return toOpportunity(data);
}

export async function saveOpportunityDecision(email, id, { decision, reason }) {
  const data = await request(email, `/opportunities/${encodeURIComponent(id)}/decision`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision: decision.toLowerCase(), reason }),
  });
  return toOpportunity(data);
}
