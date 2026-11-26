import { requestJson } from "./apiRequest";

const unavailableMessage = "The benefits service is unavailable. Please try again.";
const categoryLabels = {
  efficiency: "Efficiency",
  financial: "Financial",
  service: "Service",
  risk_reduction: "Risk",
  data: "Data",
  strategic: "Strategic",
};

function toBenefit(data) {
  return {
    ...data,
    category: categoryLabels[data.category],
    recordedOn: data.date,
    date: new Date(data.date).toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
    }),
  };
}

export async function getBenefits(email, projectId, signal) {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  const data = await requestJson(email, `/benefits${query}`, { signal }, unavailableMessage);
  return data.map(toBenefit);
}

export async function saveBenefit(email, id, data) {
  const path = id ? `/benefits/${encodeURIComponent(id)}` : "/benefits";
  const result = await requestJson(email, path, {
    method: id ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...data,
      category: Object.keys(categoryLabels).find((key) => categoryLabels[key] === data.category),
    }),
  }, unavailableMessage);
  return toBenefit(result);
}
