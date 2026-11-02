import { useState } from "react";
import {
  LockKeyhole,
  Mail,
  Network
} from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import {
  Button,
  Field
} from "../components/ui";

export function SignInPage() {
  const { isAuthenticated, signIn } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState("sarah.smith@lsbu.ac.uk");
  const [error, setError] = useState("");
  if (isAuthenticated) return <Navigate to="/opportunities" replace />;
  const submit = (event) => {
    event.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setError("Enter a valid LSBU email address.");
      return;
    }
    signIn(email.trim());
    navigate("/opportunities");
  };
  return <div className="sign-in-shell studio-login">
      <div className="sign-in-brand login-brand">
        <div className="brand-mark">
          <Network size={22} />
        </div>
        <div>
          <strong>AI Foundry</strong>
          <span>London South Bank University</span>
        </div>
      </div>
      <main className="login-artboard">
        <section className="login-story">
          <span className="eyebrow">Ideas → projects → outcomes</span>
          <h1>A shared space for making LSBU work better.</h1>
          <p>
            AI Foundry brings improvement ideas, project delivery and measurable
            benefits into one connected workspace.
          </p>
          <div className="workflow-map" aria-label="AI Foundry workflow">
            <div className="workflow-node node-idea">
              <span>01</span>
              <strong>Discover</strong>
            </div>
            <i />
            <div className="workflow-node node-assess">
              <span>02</span>
              <strong>Assess</strong>
            </div>
            <i />
            <div className="workflow-node node-deliver">
              <span>03</span>
              <strong>Deliver</strong>
            </div>
            <i />
            <div className="workflow-node node-measure">
              <span>04</span>
              <strong>Measure</strong>
            </div>
          </div>
          <div className="login-caption">
            <Network size={18} />
            <span>From first idea to delivered benefit</span>
          </div>
        </section>
        <section className="sign-in-card login-panel">
          <div className="login-panel-heading">
            <div className="sign-in-icon">
              <LockKeyhole size={22} />
            </div>
          </div>
          <h2>Sign in to AI Foundry</h2>
          <p>
            Use your university account to view your submitted opportunities.
          </p>
          <form onSubmit={submit}>
            <Field
    label="University email"
    required
    error={error}
    helper="Enter your university email address."
  >
              <div className="input-with-icon">
                <Mail size={16} />
                <input
    type="email"
    value={email}
    onChange={(event) => {
      setEmail(event.target.value);
      setError("");
    }}
    placeholder="name@lsbu.ac.uk"
  />
              </div>
            </Field>
            <Button type="submit">Sign In</Button>
          </form>
        </section>
      </main>
    </div>;
}
