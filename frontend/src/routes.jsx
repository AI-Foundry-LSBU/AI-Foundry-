import { Navigate, createBrowserRouter } from "react-router-dom";
import { AppLayout } from "./layouts/AppLayout";
import { BenefitsPage } from "./pages/BenefitsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { HackathonsPage } from "./pages/HackathonsPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { OpportunitiesPage } from "./pages/OpportunitiesPage";
import { OpportunityDetailPage } from "./pages/OpportunityDetailPage";
import { PipelinePage } from "./pages/PipelinePage";
import { ProjectDetailPage } from "./pages/ProjectDetailPage";
import { SignInPage } from "./pages/SignInPage";
import { SubmitPage } from "./pages/SubmitPage";

export const router = createBrowserRouter([
  { path: "/signin", Component: SignInPage },
  {
    path: "/",
    Component: AppLayout,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", Component: DashboardPage },
      { path: "submit", Component: SubmitPage },
      { path: "opportunities", Component: OpportunitiesPage },
      { path: "opportunities/:id", Component: OpportunityDetailPage },
      { path: "pipeline", Component: PipelinePage },
      { path: "projects/:id", Component: ProjectDetailPage },
      { path: "benefits", Component: BenefitsPage },
      { path: "hackathons", Component: HackathonsPage },
      { path: "*", Component: NotFoundPage },
    ],
  },
]);
