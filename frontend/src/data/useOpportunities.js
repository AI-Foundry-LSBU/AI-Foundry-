import { useEffect, useState } from "react";
import { getAllOpportunities, getApprovedOpportunities, getMyOpportunities, getOpportunity } from "./opportunitiesApi";

const listLoaders = {
  all: getAllOpportunities,
  approved: getApprovedOpportunities,
  mine: getMyOpportunities,
};

export function useOpportunities(email, scope, id) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!email) return;
    const controller = new AbortController();
    const loadList = listLoaders[scope];
    const request = id === undefined
      ? loadList(email, controller.signal)
      : getOpportunity(email, id, controller.signal);

    request.then(
      (data) => {
        if (!controller.signal.aborted) setResult({ email, scope, id, attempt, data });
      },
      (error) => {
        if (!controller.signal.aborted) setResult({ email, scope, id, attempt, error });
      },
    );

    return () => controller.abort();
  }, [email, scope, id, attempt]);

  const current = result?.email === email && result?.scope === scope && result?.id === id && result?.attempt === attempt ? result : null;
  return {
    data: current?.data,
    error: current?.error,
    loading: Boolean(email) && !current,
    retry: () => setAttempt((previous) => previous + 1),
  };
}
