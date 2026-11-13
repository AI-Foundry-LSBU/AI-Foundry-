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

const passwordKeys = {
  "staff@lsbu.ac.uk": "DEMO_STAFF_PASSWORD",
  "staff2@lsbu.ac.uk": "DEMO_STAFF2_PASSWORD",
  "manager@lsbu.ac.uk": "DEMO_MANAGER_PASSWORD",
  "engineer@lsbu.ac.uk": "DEMO_ENGINEER_PASSWORD"
};

export function SignInPage() {
  const { isAuthenticated, currentUser, signIn } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState("staff@lsbu.ac.uk");
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const passwordKey = passwordKeys[email.trim().toLowerCase()];
  if (isAuthenticated) return <Navigate to={currentUser.role === "AI Foundry Engineer" ? "/pipeline" : "/opportunities"} replace />;
  const submit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    if (!email.trim() || !email.includes("@") || !password) {
      setError("Enter your email and password.");
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      const user = await signIn(email, password);
      navigate(user.role === "AI Foundry Engineer" ? "/pipeline" : "/opportunities");
    } catch (error) {
      setError(error.message);
    } finally {
      setIsSubmitting(false);
    }
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
          <span className="eyebrow">Opportunities → projects → outcomes</span>
          <h1>A shared space for making LSBU work better.</h1>
          <p>
            AI Foundry brings opportunities, project delivery and measurable
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
            <span>From the first opportunity to a delivered benefit</span>
          </div>
        </section>
        <section className="sign-in-card login-panel">
          <div className="login-panel-heading">
            <div className="sign-in-icon">
              <LockKeyhole size={22} />
            </div>
          </div>
          <h2>{showForgotPassword ? "Forgot password" : "Sign in to AI Foundry"}</h2>
          <p>
            {showForgotPassword
              ? "Demo accounts do not use email. The password is saved on this computer."
              : "Use a coursework demo account to sign in."}
          </p>
          {showForgotPassword ? <form onSubmit={(event) => event.preventDefault()}>
            <Field
              label="Email"
              required
              helper="Use the same demo email you sign in with."
            >
              <div className="input-with-icon">
                <Mail size={16} />
                <input
                  type="email"
                  name="email"
                  aria-label="Email"
                  autoComplete="username"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="staff@lsbu.ac.uk"
                />
              </div>
            </Field>
            <p className="password-reminder" role="status">
              {passwordKey
                ? <>The password for <strong>{email.trim().toLowerCase()}</strong> is the value of <strong>{passwordKey}</strong> in <strong>backend/.env</strong>.</>
                : "That email is not one of the demo accounts. Use staff@lsbu.ac.uk, staff2@lsbu.ac.uk, manager@lsbu.ac.uk, or engineer@lsbu.ac.uk."}
            </p>
            <Button type="button" variant="secondary" onClick={() => setShowForgotPassword(false)}>
              Back to sign in
            </Button>
          </form> : <form onSubmit={submit}>
            <Field
    label="Email"
    required
    helper="Demo accounts: staff@lsbu.ac.uk, staff2@lsbu.ac.uk, manager@lsbu.ac.uk or engineer@lsbu.ac.uk."
  >
              <div className="input-with-icon">
                <Mail size={16} />
                <input
    type="email"
    name="email"
    aria-label="Email"
    autoComplete="username"
    required
    maxLength={254}
    value={email}
    onChange={(event) => {
      setEmail(event.target.value);
      setError("");
    }}
    placeholder="staff@lsbu.ac.uk"
  />
              </div>
            </Field>
            <Field label="Password" required helper="Use the password provided for this demo account.">
              <div className="input-with-icon">
                <LockKeyhole size={16} />
                <input type="password" name="password" aria-label="Password" autoComplete="current-password"
                  required maxLength={128} value={password}
                  onChange={(event) => { setPassword(event.target.value); setError(''); }} />
              </div>
            </Field>
            <button type="button" className="forgot-password" onClick={() => setShowForgotPassword(true)}>
              Forgot password?
            </button>
            {error && <p role="alert" className="error-text">{error}</p>}
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Signing in…' : 'Sign In'}</Button>
          </form>}
        </section>
      </main>
    </div>;
}
