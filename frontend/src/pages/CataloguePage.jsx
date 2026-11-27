import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import {
  cataloguePayload,
  catalogueProblems,
  catalogueStatus,
  listCatalogue,
  saveCatalogueEntry,
} from "../data/catalogueApi";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  StatusBadge,
} from "../components/ui";

const emptyForm = {
  name: "",
  description: "",
  keywords: [],
  href: "",
  accessInstructions: "",
  visibility: "all_users",
  active: true,
  verified: false,
  verificationNotes: "",
};

const audiences = {
  all_users: "Everyone",
  manager_only: "Managers only",
};

function formFrom(entry) {
  return {
    name: entry.name,
    description: entry.description,
    keywords: [...entry.keywords],
    href: entry.href ?? "",
    accessInstructions: entry.accessInstructions ?? "",
    visibility: entry.visibility,
    active: entry.active,
    verified: entry.verified,
    verificationNotes: entry.verificationNotes ?? "",
  };
}

function formatWhen(value) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function CatalogueForm({ entry, onClose, onSaved }) {
  const { currentUser } = useApp();
  const [form, setForm] = useState(entry ? formFrom(entry) : emptyForm);
  const [keyword, setKeyword] = useState("");
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({
      ...current,
      [key]: undefined,
      ...(key === "href" || key === "accessInstructions" ? { href: undefined, accessInstructions: undefined } : {}),
      ...(key === "verified" && !value ? { verificationNotes: undefined } : {}),
    }));
  };
  const addKeyword = () => {
    const next = keyword.trim().toLowerCase();
    setKeyword("");
    if (!next || form.keywords.includes(next)) return;
    update("keywords", [...form.keywords, next]);
  };
  const save = async (event) => {
    event.preventDefault();
    const payload = cataloguePayload(form, keyword);
    const problems = catalogueProblems(payload);
    setErrors(problems);
    if (Object.keys(problems).length) return;
    setKeyword("");
    setSaving(true);
    setSaveError("");
    try {
      await saveCatalogueEntry(currentUser.email, entry?.id, payload);
      onSaved();
    } catch (error) {
      setErrors(error.fields ?? {});
      setSaveError(error.message);
      setSaving(false);
    }
  };
  return <Modal title={entry ? "Edit solution" : "Add a solution"} onClose={() => { if (!saving) onClose(); }}>
    <form className="modal-form catalogue-form" onSubmit={save}>
      {saveError && <p role="alert" className="error-text">{saveError}</p>}
      <div className="catalogue-grid">
        <Field label="Name" required error={errors.name}>
          <input value={form.name} disabled={saving} aria-invalid={Boolean(errors.name)} maxLength={120} onChange={(event) => update("name", event.target.value)} />
        </Field>
        <Field label="Who can see it" error={errors.visibility}>
          <select value={form.visibility} disabled={saving} aria-invalid={Boolean(errors.visibility)} onChange={(event) => update("visibility", event.target.value)}>
            <option value="all_users">Everyone</option>
            <option value="manager_only">Managers only</option>
          </select>
        </Field>
        <Field label="Description" required error={errors.description}>
          <textarea rows={4} value={form.description} disabled={saving} aria-invalid={Boolean(errors.description)} onChange={(event) => update("description", event.target.value)} />
        </Field>
        <div className={`field catalogue-span ${errors.keywords ? "field-error" : ""}`}>
          <span className="field-label">Keywords</span>
          <div className="keyword-editor">
            <input
              value={keyword}
              disabled={saving}
              aria-label="Keyword"
              placeholder="Add a word the chatbot should match"
              onChange={(event) => setKeyword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === ",") {
                  event.preventDefault();
                  addKeyword();
                }
              }}
            />
            <Button type="button" variant="secondary" disabled={saving} onClick={addKeyword}>Add</Button>
          </div>
          {form.keywords.length > 0 && <ul className="keyword-chips">
            {form.keywords.map((word) => <li key={word}>
              {word}
              <button type="button" disabled={saving} aria-label={`Remove ${word}`} onClick={() => update("keywords", form.keywords.filter((item) => item !== word))}>×</button>
            </li>)}
          </ul>}
          {errors.keywords ? <small className="error-text">{errors.keywords}</small> : <small>Up to 20 words. The chatbot uses these, the name and the description.</small>}
        </div>
        <div className="catalogue-span">
          <Field label="Link" error={errors.href} helper="An HTTPS address, if the service has one.">
            <input value={form.href} disabled={saving} aria-invalid={Boolean(errors.href)} placeholder="https://" onChange={(event) => update("href", event.target.value)} />
          </Field>
        </div>
        <Field label="How to reach it" error={errors.accessInstructions} helper="Required when there is no link.">
          <textarea rows={3} value={form.accessInstructions} disabled={saving} aria-invalid={Boolean(errors.accessInstructions)} onChange={(event) => update("accessInstructions", event.target.value)} />
        </Field>
        <fieldset className="catalogue-choices catalogue-span">
          <legend>Publication</legend>
          <label>
            <input type="checkbox" checked={form.active} disabled={saving} onChange={(event) => update("active", event.target.checked)} />
            <span>
              <strong>Active</strong>
              <small>Turn this off to archive it. Archived entries stay here, and the chatbot will not recommend them.</small>
            </span>
          </label>
          <label>
            <input type="checkbox" checked={form.verified} disabled={saving} onChange={(event) => update("verified", event.target.checked)} />
            <span>
              <strong>Verified</strong>
              <small>The chatbot recommends a solution only when it is active and verified.</small>
            </span>
          </label>
        </fieldset>
        <Field label="How you checked it" required={form.verified} error={errors.verificationNotes} helper="Needed before an entry can be verified.">
          <textarea rows={3} value={form.verificationNotes} disabled={saving} aria-invalid={Boolean(errors.verificationNotes)} onChange={(event) => update("verificationNotes", event.target.value)} />
        </Field>
      </div>
      <div className="modal-actions">
        <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save solution"}</Button>
      </div>
    </form>
  </Modal>;
}

export function CataloguePage() {
  const { currentUser, role } = useApp();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [state, setState] = useState("all");
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const fullList = useRef([]);
  const fullTotal = useRef(0);
  const fullState = useRef("all");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState(null);
  useEffect(() => {
    if (role !== "Digital Project Manager") return undefined;
    const controller = new AbortController();
    let cancelled = false;
    setPending(true);
    const timer = setTimeout(async () => {
      try {
        const page = await listCatalogue(currentUser.email, { q: query.trim(), state, signal: controller.signal });
        if (cancelled) return;
        if (!query.trim()) {
          fullList.current = page.items;
          fullTotal.current = page.total;
          fullState.current = state;
        }
        setEntries(page.items);
        setTotal(page.total);
        setError(null);
      } catch (loadError) {
        if (loadError.name === "AbortError" || cancelled) return;
        setError(loadError);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setPending(false);
        }
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [currentUser.email, query, role, state, version]);
  if (role !== "Digital Project Manager") return <EmptyState
    title="Access restricted"
    text="The Solution Catalogue is maintained by the Digital Project Manager."
    action={<Button onClick={() => navigate("/dashboard")}>Dashboard</Button>}
  />;
  const openNew = () => setEditing("new");
  const needle = query.trim().toLowerCase();
  const catalogueComplete = fullState.current === state && fullList.current.length > 0 && fullList.current.length === fullTotal.current;
  const shown = !needle ? entries : (catalogueComplete ? fullList.current : entries).filter((entry) => {
    const haystack = [entry.name, entry.description, ...(entry.keywords ?? [])].join("\n").toLowerCase();
    const nameTokens = [entry.name, ...(entry.keywords ?? [])].join("\n").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
    return needle.split(/\s+/).every((word) => word.length < 3
      ? nameTokens.some((token) => token.startsWith(word))
      : haystack.includes(word));
  });
  const narrowed = needle !== "" || state !== "all";
  const states = [
    ["all", "All"],
    ["verified", "Verified"],
    ["draft", "Draft"],
    ["archived", "Archived"],
  ];
  return <div className="catalogue-page">
    <PageHeader
      title="Solution Catalogue"
      subtitle="These are the services the chatbot can recommend. A service is offered only after you verify it."
      actions={<Button onClick={openNew}>Add a solution</Button>}
    />
    <Card className="table-card catalogue-board">
      <div className="catalogue-toolbar">
        <label className="catalogue-search">
          <Search size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, description or keyword" aria-label="Search the catalogue" />
        </label>
        <div className="catalogue-states" role="tablist" aria-label="State">
          {states.map(([value, label]) => <button
            key={value}
            type="button"
            role="tab"
            aria-selected={state === value}
            className={state === value ? "is-selected" : ""}
            onClick={() => setState(value)}
          >
            {label}
          </button>)}
        </div>
      </div>
      {loading || (pending && entries.length === 0) ? <div role="status"><EmptyState title="Loading the catalogue…" /></div> : error ? <div role="alert">
        <EmptyState title="Could not load the catalogue" text={error.message} action={<Button onClick={() => setVersion((item) => item + 1)}>Try again</Button>} />
      </div> : shown.length === 0 ? <EmptyState
        title={narrowed ? "Nothing matches" : "No solutions yet"}
        text={narrowed ? "Try another search, or show every state." : "Add a service, check how to reach it, then mark it verified."}
        action={narrowed ? <Button variant="secondary" onClick={() => { setQuery(""); setState("all"); }}>Show all</Button> : <Button onClick={openNew}>Add a solution</Button>}
      /> : <>
        <div className="table-wrap fit-table">
          <table>
            <thead>
              <tr>
                <th>Solution</th>
                <th>Audience</th>
                <th>State</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((entry) => <tr key={entry.id}>
                <td>
                  <div className="title-cell">
                    <strong>{entry.name}</strong>
                    <p className="catalogue-summary">{entry.description}</p>
                  </div>
                </td>
                <td><span className="catalogue-audience">{audiences[entry.visibility] ?? entry.visibility}</span></td>
                <td><StatusBadge status={catalogueStatus(entry)} /></td>
                <td>{formatWhen(entry.updatedAt)}</td>
                <td>
                  <button type="button" className="text-button" onClick={() => setEditing(entry)}>Edit</button>
                </td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <p className="list-foot">
          {needle && catalogueComplete
            ? `${shown.length} ${shown.length === 1 ? "solution" : "solutions"}`
            : entries.length === total
            ? `${total} ${total === 1 ? "solution" : "solutions"}`
            : `Showing ${shown.length} of ${total}. Search to narrow the list.`}
        </p>
      </>}
    </Card>
    {editing && <CatalogueForm
      entry={editing === "new" ? null : editing}
      onClose={() => setEditing(null)}
      onSaved={() => {
        setEditing(null);
        setVersion((item) => item + 1);
      }}
    />}
  </div>;
}
