import { useNavigate } from "react-router-dom";
import {
  Button,
  EmptyState
} from "../components/ui";

export function NotFoundPage() {
  const navigate = useNavigate();
  return <EmptyState
    title="Page not found"
    text="The page you were looking for does not exist."
    action={<Button onClick={() => navigate("/dashboard")}>
          Return to dashboard
        </Button>}
  />;
}
