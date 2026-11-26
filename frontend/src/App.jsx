import { RouterProvider } from "react-router-dom";
import { AppProvider, useApp } from "./context/AppContext";
import { router } from "./routes";

export default function App() {
  return (
    <AppProvider>
      <SessionGate />
    </AppProvider>
  );
}

function SessionGate() {
  const { authLoading, authError, retrySession } = useApp();
  if (authLoading) return <main className="page-container" role="status">Checking sign-in…</main>;
  if (authError) return <main className="page-container">
    <h1>Could not connect</h1>
    <p role="alert">{authError}</p>
    <button onClick={retrySession}>Try again</button>
  </main>;
  return <RouterProvider router={router} />;
}
