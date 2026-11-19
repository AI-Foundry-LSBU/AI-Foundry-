import { requestApi } from "./apiRequest";

export function getNotifications(signal) {
  return requestApi("/notifications", { signal }, "Updates could not be loaded. Please try again.");
}

export function markNotificationRead(id) {
  return requestApi(`/notifications/${id}/read`, { method: "POST" }, "That update could not be dismissed. Please try again.");
}
