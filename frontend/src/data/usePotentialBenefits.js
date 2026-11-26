import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import { requestJson } from "./apiRequest";

const unavailableMessage = "Potential benefits are unavailable. Check that the backend is running and try again.";

function totals(reviews) {
  const benefits = reviews.flatMap((review) => review.recommendation === "worth_pursuing" ? review.benefits ?? [] : []);
  const sum = (unit) => benefits.filter((item) => item.unit === unit && item.estimated != null).reduce((total, item) => total + item.estimated, 0);
  return { hours: sum("Hours/month"), savings: sum("GBP/year"), benefits };
}

export function usePotentialBenefits() {
  const { currentUser, role } = useApp();
  const isLive = role === currentUser?.role && role !== "Staff";
  const email = isLive ? currentUser.email : null;
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!email) return undefined;
    const controller = new AbortController();
    requestJson(email, "/benefit-reviews", { signal: controller.signal }, unavailableMessage).then(
      (data) => { if (!controller.signal.aborted) setResult({ email, attempt, data }); },
      (error) => { if (!controller.signal.aborted) setResult({ email, attempt, error }); }
    );
    return () => controller.abort();
  }, [email, attempt]);

  const current = result?.email === email && result?.attempt === attempt ? result : null;
  const reviews = current?.data ?? [];
  const summed = totals(reviews);
  return {
    isLive,
    reviews,
    benefits: summed.benefits,
    hours: summed.hours,
    savings: summed.savings,
    error: current?.error,
    loading: isLive && !current,
    retry: () => setAttempt((previous) => previous + 1)
  };
}
