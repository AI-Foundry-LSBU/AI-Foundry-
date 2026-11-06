import { useEffect, useState } from "react";
import { getMyOpportunities, getOpportunity } from "./opportunitiesApi";

export function useStaffOpportunities(email, id) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!email) return;
    const controller = new AbortController();
    const request = id === undefined
      ? getMyOpportunities(email, controller.signal)
      : getOpportunity(email, id, controller.signal);

    request.then(
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
    data: current?.data,
    error: current?.error,
    loading: Boolean(email) && !current,
    retry: () => setAttempt((previous) => previous + 1),
  };
}
