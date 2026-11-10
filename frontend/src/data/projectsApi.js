import { requestJson } from "./apiRequest";

const unavailableMessage = "The projects API is unavailable. Check that the backend is running and try again.";
export const deliveryStatusLabels = {
  not_started: "Not Started",
  in_progress: "In Progress",
  testing: "Testing",
  completed: "Completed",
};

export const deliveryStatuses = Object.values(deliveryStatusLabels);

function displayDate(value) {
  return value ? new Date(value).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  }) : "Not scheduled";
}

function toProject(data) {
  return {
    ...data,
    status: deliveryStatusLabels[data.status],
    priority: data.priority ? data.priority[0].toUpperCase() + data.priority.slice(1) : "Not set",
    startDate: displayDate(data.startDate),
    targetDate: displayDate(data.targetDate),
    notes: data.notes?.[0]?.text ?? "No progress notes yet.",
    activity: (data.notes ?? []).map((note) => ({ ...note, date: displayDate(note.createdAt) })),
  };
}

export async function getProjects(email, id, signal) {
  const path = id === undefined ? "/projects" : `/projects/${encodeURIComponent(id)}`;
  const data = await requestJson(email, path, { signal }, unavailableMessage);
  return id === undefined ? data.map(toProject) : toProject(data);
}

async function saveProject(email, path, method, data) {
  const saved = await requestJson(email, path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }, unavailableMessage);
  return toProject(saved);
}

export function createDeliveryProject(email, opportunityId, { startDate, targetDate }) {
  return saveProject(email, "/projects", "POST", {
    opportunityId, startDate: startDate || undefined, targetDate: targetDate || undefined,
  });
}

export function updateDeliveryProject(email, id, { status, ...changes }) {
  return saveProject(email, `/projects/${encodeURIComponent(id)}`, "PATCH", {
    ...changes, status: Object.keys(deliveryStatusLabels).find((key) => deliveryStatusLabels[key] === status),
  });
}
