import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import { getBenefits } from "./benefitsApi";

export function useBenefits(projectId) {
  const { currentUser, role, benefits } = useApp();
  const isLive = role === currentUser?.role && role !== "Staff";
  const email = isLive ? currentUser.email : null;
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!email) return;
    const controller = new AbortController();
    getBenefits(email, projectId, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setResult({ email, projectId, attempt, data });
      },
      (error) => {
        if (!controller.signal.aborted) setResult({ email, projectId, attempt, error });
      },
    );
    return () => controller.abort();
  }, [email, projectId, attempt]);

  const current = result?.email === email && result?.projectId === projectId && result?.attempt === attempt ? result : null;
  const samples = projectId ? benefits.filter((benefit) => benefit.projectId === projectId) : benefits;
  return {
    isLive,
    data: isLive ? current?.data : samples,
    error: isLive ? current?.error : undefined,
    loading: isLive && !current,
    retry: () => setAttempt((previous) => previous + 1),
  };
}
