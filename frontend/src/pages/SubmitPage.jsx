import { useState } from "react";
import {
  Check,
  Send
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { departments } from "../data/options";
import { submitOpportunity } from "../data/opportunitiesApi";
import {
  Button,
  Card,
  EmptyState,
  Field,
  PageHeader
} from "../components/ui";

export function SubmitPage() {
  const { role, currentUser } = useApp();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "",
    department: "",
    problemDescription: "",
    proposedImprovement: "",
    expectedBenefits: ""
  });
  const [errors, setErrors] = useState({});
  const [submittedId, setSubmittedId] = useState("");
  const [submissionError, setSubmissionError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };
  if (role !== "Staff")
    return <EmptyState
      title="Access restricted"
      text="Idea submission is available through the Staff portal."
      action={<Button onClick={() => navigate("/dashboard")}>
            Return to dashboard
          </Button>}
    />;
  const submit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    setSubmissionError("");
    const nextErrors = {};
    if (form.title.trim().length < 5)
      nextErrors.title = "Enter a clear title for this opportunity.";
    if (!form.department)
      nextErrors.department = "Select the department responsible for this opportunity.";
    if (form.problemDescription.trim().length < 20)
      nextErrors.problemDescription = "Describe the current problem or challenge in at least 20 characters.";
    if (form.proposedImprovement.trim().length < 20)
      nextErrors.proposedImprovement = "Describe the suggested improvement in at least 20 characters.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setIsSubmitting(true);
    try {
      const data = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()]));
      const opportunity = await submitOpportunity(currentUser.email, data);
      setSubmittedId(opportunity.id);
    } catch (error) {
      setErrors(error.fields ?? {});
      setSubmissionError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };
  if (submittedId)
    return <div className="success-page">
        <Card className="success-card">
          <div className="success-icon">
            <Check size={30} />
          </div>
          <span className="eyebrow">Submission complete</span>
          <h1>Opportunity Submitted Successfully</h1>
          <p>
            Your opportunity has been submitted to the AI Foundry for review.
          </p>
          <div className="success-reference">
            <span>Opportunity reference</span>
            <strong>{submittedId}</strong>
          </div>
          <div className="success-actions">
            <Button onClick={() => navigate("/opportunities")}>
              View My Opportunities
            </Button>
            <Button
      variant="secondary"
      onClick={() => {
        setForm({
          title: "",
          department: "",
          problemDescription: "",
          proposedImprovement: "",
          expectedBenefits: ""
        });
        setSubmittedId("");
      }}
    >
              Submit Another Opportunity
            </Button>
          </div>
        </Card>
      </div>;
  return <>
      <PageHeader
    title="Submit an Opportunity"
    subtitle="Tell us about a process or service that could be improved."
  />
      <form onSubmit={submit} noValidate>
        <Card className="form-card">
          <div className="form-intro">
            <div>
              <h2>Opportunity details</h2>
              <p>
                Give the AI Foundry team enough context to understand the
                challenge and its potential impact.
              </p>
            </div>
          </div>
          <div className="form-grid">
            <Field
    label="Opportunity Title"
    required
    error={errors.title}
    helper="Use a short, descriptive title."
  >
              <input
    required
    maxLength={120}
    aria-invalid={Boolean(errors.title)}
    value={form.title}
    onChange={(event) => update("title", event.target.value)}
    placeholder="e.g. Automate student enquiry routing"
  />
            </Field>
            <Field label="Department" required error={errors.department}>
              <select
    required
    aria-invalid={Boolean(errors.department)}
    value={form.department}
    onChange={(event) => update("department", event.target.value)}
  >
                <option value="">Select a department</option>
                {departments.map((item) => <option key={item}>{item}</option>)}
              </select>
            </Field>
            <Field
    label="Problem Description"
    required
    error={errors.problemDescription}
    helper={`${form.problemDescription.length}/800 characters`}
  >
              <textarea
    rows={6}
    required
    aria-invalid={Boolean(errors.problemDescription)}
    maxLength={800}
    value={form.problemDescription}
    onChange={(event) => update("problemDescription", event.target.value)}
    placeholder="What currently happens, who is affected and what impact does it have?"
  />
            </Field>
            <Field
    label="Suggested Improvement"
    required
    error={errors.proposedImprovement}
    helper={`${form.proposedImprovement.length}/800 characters`}
  >
              <textarea
    rows={6}
    required
    aria-invalid={Boolean(errors.proposedImprovement)}
    maxLength={800}
    value={form.proposedImprovement}
    onChange={(event) => update("proposedImprovement", event.target.value)}
    placeholder="Describe the outcome you would like to achieve. You do not need to propose a technical solution."
  />
            </Field>
            <Field
    label="Expected Benefits"
    error={errors.expectedBenefits}
    helper={`${form.expectedBenefits.length}/500 characters \xB7 Optional`}
  >
              <textarea
    rows={6}
    maxLength={500}
    aria-invalid={Boolean(errors.expectedBenefits)}
    value={form.expectedBenefits}
    onChange={(event) => update("expectedBenefits", event.target.value)}
    placeholder="What do you expect to improve—for example time saved, service quality, reduced risk or better data?"
  />
            </Field>
          </div>
          {submissionError && <p role="alert" className="error-text">{submissionError}</p>}
          <div className="form-footer">
            <p>
              By submitting, you confirm that this information can be reviewed
              by the AI Foundry team.
            </p>
            <div>
              <Button
    type="button"
    variant="secondary"
    onClick={() => navigate("/opportunities")}
  >
                Cancel
              </Button>
              <Button type="submit" icon={Send} disabled={isSubmitting}>
                {isSubmitting ? "Submitting…" : "Submit Opportunity"}
              </Button>
            </div>
          </div>
        </Card>
      </form>
    </>;
}
