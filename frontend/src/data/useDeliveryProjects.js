import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import { getProjects } from "./projectsApi";

export function useDeliveryProjects(id) {
  const { currentUser, role, projects } = useApp();
  const isLive = role === currentUser?.role && role !== "Staff";
  const email = isLive ? currentUser.email : null;
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!email) return;
    const controller = new AbortController();
    getProjects(email, id, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setResult({ email, id, attempt, data });
      },
      (error) => {
        if (!controller.signal.aborted) setResult({ email, id, attempt, error });
      },
    );
    return () => controller.abort();
  }, [email, id, attempt]);

  const current = result?.email === email && result?.id === id && result?.attempt === attempt ? result : null;
  return {
    isLive,
    data: isLive ? current?.data : id === undefined ? projects : projects.find((project) => project.id === id),
    error: isLive ? current?.error : undefined,
    loading: isLive && !current,
    retry: () => setAttempt((previous) => previous + 1),
  };
}
