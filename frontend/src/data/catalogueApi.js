import { requestJson } from "./apiRequest";

const unavailableMessage = "The solution catalogue is unavailable. Please try again.";

export { cataloguePayload, catalogueProblems, catalogueStatus } from "./catalogueForm.js";

function request(email, path, options) {
  return requestJson(email, path, options, unavailableMessage);
}

export function listCatalogue(email, { q = "", state = "all", signal } = {}) {
  const query = new URLSearchParams({ state, limit: "50" });
  if (q) query.set("q", q);
  return request(email, `/solutions/catalogue?${query}`, { signal });
}

export function saveCatalogueEntry(email, id, payload) {
  return request(email, id ? `/solutions/catalogue/${encodeURIComponent(id)}` : "/solutions/catalogue", {
    method: id ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
