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

async function request(email, path, options = {}) {
  const response = await fetch(`/api/v1${path}`, {
    ...options,
    headers: { "X-User-Email": email, ...options.headers },
  }).catch((error) => {
    if (error.name === "AbortError") throw error;
    throw new Error(unavailableMessage);
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    const message = response.status === 401
      ? "Sign out and sign in with a seeded demo email, such as staff@example.com."
      : data?.message ?? unavailableMessage;
    throw Object.assign(new Error(message), { status: response.status, fields: data?.fields });
  }

  return data;
}

function toOpportunity(data) {
  const priority = data.priority ?? data.assessment?.priority;
  const category = data.category ?? data.assessment?.category;
  return {
    ...data,
    status: statusLabels[data.status] ?? data.status,
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

async function getOpportunityPages(email, path, signal) {
  const first = await request(email, `${path}?pageSize=100`, { signal });
  const opportunities = new Map(first.items.map((item) => [item.id, item]));
  // The existing search and status tabs filter the whole list.
  for (let page = 2; page <= Math.ceil(first.total / first.pageSize); page++) {
    const result = await request(email, `${path}?pageSize=100&page=${page}`, { signal });
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

export async function getOpportunity(email, id, signal) {
  const data = await request(email, `/opportunities/${encodeURIComponent(id)}`, { signal });
  return toOpportunity(data);
}

export async function deleteOpportunity(email, id) {
  let response;
  try {
    response = await fetch(`/api/v1/opportunities/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { "X-User-Email": email }
    });
  } catch {
    throw new Error(unavailableMessage);
  }

  if (response.status === 204) return;
  const data = await response.json().catch(() => null);
  throw Object.assign(new Error(data?.message ?? unavailableMessage), { status: response.status });
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
