import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";

const passwordKeys = {
  "staff@lsbu.ac.uk": "DEMO_STAFF_PASSWORD",
  "staff2@lsbu.ac.uk": "DEMO_STAFF2_PASSWORD",
  "manager@lsbu.ac.uk": "DEMO_MANAGER_PASSWORD",
  "engineer@lsbu.ac.uk": "DEMO_ENGINEER_PASSWORD"
};

function homeFor(role) {
  if (role === "Digital Project Manager" || role === "AI Foundry Engineer") return "/dashboard";
  return "/opportunities";
}

function OrgIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1c1f3a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="3" width="6" height="5" rx="1" />
    <rect x="3" y="16" width="6" height="5" rx="1" />
    <rect x="15" y="16" width="6" height="5" rx="1" />
    <path d="M12 8v4M6 16v-2h12v2" />
  </svg>;
}

export function SignInPage() {
  const { isAuthenticated, currentUser, signIn } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState("staff@lsbu.ac.uk");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const passwordKey = passwordKeys[email.trim().toLowerCase()];
  if (isAuthenticated) return <Navigate to={homeFor(currentUser.role)} replace />;
  const submit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    if (!email.trim() || !email.includes("@") || !password) {
      setError("Enter your email and password.");
      return;
    }
    setError("");
    setIsSubmitting(true);
    try {
      const user = await signIn(email, password);
      navigate(homeFor(user.role));
    } catch (signInError) {
      setError(signInError.message);
    } finally {
      setIsSubmitting(false);
    }
  };
  return <div className="bubble-signin">
    <div className="bubble-field" aria-hidden="true">
      <span className="bubble b-pink" style={{ width: 520, height: 520, top: "-18%", left: "-8%", "--dur": "24s", "--dx": "16px", "--dy": "-20px" }} />
      <span className="bubble b-coral" style={{ width: 560, height: 560, top: "62%", left: "78%", "--dur": "26s", "--delay": "-6s", "--dx": "-18px", "--dy": "16px" }} />
      <span className="bubble b-purple" style={{ width: 300, height: 300, top: "-10%", left: "80%", "--dur": "22s", "--delay": "-3s", "--dx": "-14px", "--dy": "18px" }} />
      <span className="bubble b-lav" style={{ width: 260, height: 260, top: "70%", left: "2%", "--dur": "22s", "--delay": "-9s", "--dx": "14px", "--dy": "-14px" }} />
      <span className="bubble b-purple" style={{ width: 90, height: 90, top: "30%", left: "6%", "--dur": "16s", "--delay": "-4s", "--dx": "10px", "--dy": "-12px" }} />
      <span className="bubble b-coral" style={{ width: 70, height: 70, top: "14%", left: "64%", "--dur": "15s", "--delay": "-2s", "--dx": "8px", "--dy": "-10px" }} />
      <span className="bubble b-ring" style={{ width: 180, height: 180, top: "58%", left: "88%", "--dur": "20s", "--delay": "-5s", "--dx": "-10px", "--dy": "12px" }} />
    </div>
    <div className="bubble-card-wrap">
      <main className="bubble-card">
        <section className="bubble-left">
          <div className="bubble-brand">
            <div className="bubble-mark"><OrgIcon /></div>
            <div>
              <div className="bubble-name">AI Foundry</div>
              <div className="bubble-sub">London South Bank University</div>
            </div>
          </div>
          <div className="bubble-hero">
            <p className="bubble-eyebrow">Opportunities → projects → outcomes</p>
            <h1>A shared space for making LSBU work better.</h1>
            <p className="bubble-lede">AI Foundry brings opportunities, project delivery and measurable benefits into one connected workspace.</p>
            <div className="bubble-steps">
              <div className="bubble-step"><span className="bubble-num n1">01</span>Discover</div>
              <div className="bubble-step"><span className="bubble-num n2">02</span>Assess</div>
              <div className="bubble-step"><span className="bubble-num n3">03</span>Deliver</div>
              <div className="bubble-step"><span className="bubble-num n4">04</span>Measure</div>
            </div>
            <div className="bubble-note">
              <OrgIcon />
              <span>From the first opportunity to a delivered benefit</span>
            </div>
          </div>
        </section>
        <section className="bubble-right">
          {showForgotPassword ? <form className="bubble-form" onSubmit={(event) => event.preventDefault()}>
            <div className="bubble-lock" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1c1f3a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /><circle cx="12" cy="16" r="1" /></svg>
            </div>
            <h2>Forgot password</h2>
            <p className="bubble-form-sub">Demo accounts do not use email. The password is saved on this computer.</p>
            <label htmlFor="forgot-email">Email <span className="bubble-req">*</span></label>
            <div className="bubble-field-input">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
              <input id="forgot-email" type="email" name="email" autoComplete="username" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <p className="bubble-hint" role="status">
              {passwordKey
                ? <>The password for <strong>{email.trim().toLowerCase()}</strong> is the value of <strong>{passwordKey}</strong> in <strong>backend/.env</strong>.</>
                : "That email is not one of the demo accounts. Use staff@lsbu.ac.uk, staff2@lsbu.ac.uk, manager@lsbu.ac.uk, or engineer@lsbu.ac.uk."}
            </p>
            <button type="button" className="bubble-submit" onClick={() => setShowForgotPassword(false)}>Back to sign in</button>
          </form> : <form className="bubble-form" onSubmit={submit}>
            <div className="bubble-lock" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1c1f3a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /><circle cx="12" cy="16" r="1" /></svg>
            </div>
            <h2>Sign in to AI Foundry</h2>
            <p className="bubble-form-sub">Use a coursework demo account to sign in.</p>
            <label htmlFor="email">Email <span className="bubble-req">*</span></label>
            <div className="bubble-field-input">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
              <input id="email" type="email" name="email" aria-label="Email" autoComplete="username" required maxLength={254} value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} />
            </div>
            <label htmlFor="password">Password <span className="bubble-req">*</span></label>
            <div className="bubble-field-input">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
              <input id="password" type="password" name="password" aria-label="Password" autoComplete="current-password" required maxLength={128} value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} />
            </div>
            <p className="bubble-hint">Use the password provided for this demo account.</p>
            <button type="button" className="bubble-forgot" onClick={() => setShowForgotPassword(true)}>Forgot password?</button>
            {error && <p role="alert" className="bubble-error">{error}</p>}
            <button type="submit" className="bubble-submit" disabled={isSubmitting}>{isSubmitting ? "Signing in…" : "Sign In"}</button>
          </form>}
        </section>
      </main>
    </div>
  </div>;
}
