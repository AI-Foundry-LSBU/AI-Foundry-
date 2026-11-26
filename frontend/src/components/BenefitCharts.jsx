import { useState } from "react";

const benefitCategoryLabels = {
  efficiency: "Efficiency",
  financial: "Cost saving",
  service: "Service",
  risk_reduction: "Risk reduction",
  data: "Data quality",
  strategic: "Strategic value"
};

const NAVY = "#1c1f3a";
const PINK = "#c44f88";
const GRID = "#ddd7f2";

export function benefitGain(item) {
  if (item?.current == null || item?.proposed == null) return null;
  return Math.max(item.current - item.proposed, 0);
}

function howWell(effort) {
  return 6 - effort;
}

function measureName(item) {
  const text = `${item.description ?? ""} ${item.unit ?? ""}`.toLowerCase();
  if (/time|hour|minute|delay|wait|retyp|manual|faster/.test(text)) return "Time saving";
  if (/cost|money|budget|spend|£|gbp/.test(text) || item.category === "financial") return "Cost saving";
  if (item.category === "service" || /student|communicat|service/.test(text)) return "Service";
  if (item.category === "risk_reduction" || /risk|error|mistake/.test(text)) return "Risk reduction";
  if (item.category === "data") return "Data quality";
  if (item.category === "strategic") return "Strategic value";
  return benefitCategoryLabels[item.category] ?? "Benefit";
}

function chartRows(benefits) {
  const used = new Set();
  return (benefits ?? []).flatMap((item) => {
    if (benefitGain(item) == null) return [];
    let label = measureName(item);
    if (used.has(label)) {
      const base = benefitCategoryLabels[item.category] ?? label;
      label = used.has(base) ? `${label} · ${item.description.split(" ").slice(0, 3).join(" ")}` : base;
    }
    used.add(label);
    return [{
      ...item,
      label,
      now: howWell(item.current),
      next: howWell(item.proposed)
    }];
  });
}

function noImprovementRows() {
  return [
    ["Time saving", "No extra time saving was found."],
    ["Efficiency", "No extra efficiency was found."],
    ["Service", "No extra improvement for students or staff was found."]
  ].map(([label, description]) => ({ label, description, now: 0, next: 0 }));
}

function savingName(item) {
  if (item.unit === "Hours/month") return "Time saved";
  if (item.unit === "GBP/year" || item.category === "financial") return "Money saved";
  if (item.unit === "Cases/month") return "Cases avoided";
  if (item.unit === "Days") return "Days saved";
  if (item.unit === "Percent") return "Share improved";
  return measureName(item);
}

function amountLabel(item) {
  if (item.unit === "GBP/year") return `£${item.estimated}/year`;
  if (item.unit === "Hours/month") return `${item.estimated} hours/month`;
  if (item.unit === "Cases/month") return `${item.estimated} cases/month`;
  if (item.unit === "Days") return `${item.estimated} days`;
  if (item.unit === "Percent") return `${item.estimated}%`;
  return String(item.estimated);
}

function savingRows(benefits, worth, showBlank) {
  const blank = (detail) => [
    { label: "Time saved", detail, width: "0%" },
    { label: "Money saved", detail, width: "0%" }
  ];
  if (!worth) return blank("None");
  const stated = (benefits ?? []).filter((item) => typeof item.estimated === "number" && item.estimated >= 0);
  if (!stated.length) return showBlank ? blank("Not stated") : [];
  const maxByUnit = {};
  for (const item of stated) maxByUnit[item.unit] = Math.max(maxByUnit[item.unit] ?? 0, item.estimated);
  const rows = stated.map((item) => ({
    label: savingName(item),
    detail: amountLabel(item),
    width: item.estimated === 0 ? "0%" : `${Math.max((item.estimated / maxByUnit[item.unit]) * 100, 12)}%`
  }));
  if (showBlank && !stated.some((item) => item.unit === "GBP/year" || item.category === "financial")) {
    rows.push({ label: "Money saved", detail: "Not stated", width: "0%" });
  }
  return rows.filter((row) => row.label !== "Cases avoided");
}

function statedBenefitItems(stated) {
  if (!stated) return [];
  const items = [];
  if (typeof stated.hoursPerMonth === "number") items.push({ unit: "Hours/month", estimated: stated.hoursPerMonth, category: "efficiency", description: "Time saved" });
  if (typeof stated.savingsPerYear === "number") items.push({ unit: "GBP/year", estimated: stated.savingsPerYear, category: "financial", description: "Money saved" });
  return items;
}

function ComparisonLine({ rows }) {
  const width = 720;
  const height = 300;
  const pad = { l: 56, r: 36, t: 28, b: 52 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const xAt = (index) => {
    if (rows.length === 1) return pad.l + innerW / 2;
    const inset = Math.min(innerW * 0.16, 80);
    return pad.l + inset + (index / (rows.length - 1)) * (innerW - inset * 2);
  };
  const yAt = (value) => pad.t + ((5 - value) / 5) * innerH;
  const line = (key) => rows.map((row, index) => `${index ? "L" : "M"} ${xAt(index)} ${yAt(row[key])}`).join(" ");
  const summary = rows.map((row) => `${row.label}: ${row.now} now, ${row.next} with this opportunity`).join(". ");

  return <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`How well the work would go. ${summary}.`}>
    {[0, 1, 2, 3, 4, 5].map((tick) => <g key={tick}>
      <line x1={pad.l} x2={width - pad.r} y1={yAt(tick)} y2={yAt(tick)} stroke={GRID} />
      <text className="chart-tick" x={pad.l - 10} y={yAt(tick) + 4} textAnchor="end">{tick}</text>
    </g>)}
    <text className="chart-axis-name" x={16} y={pad.t + innerH / 2} textAnchor="middle" transform={`rotate(-90 16 ${pad.t + innerH / 2})`}>How well it works</text>
    {rows.length > 1 && <path d={line("now")} fill="none" stroke={NAVY} strokeWidth="2.5" />}
    {rows.length > 1 && <path d={line("next")} fill="none" stroke={PINK} strokeWidth="2.5" />}
    {rows.map((row, index) => <g key={row.label}>
      <circle cx={xAt(index)} cy={yAt(row.now)} r="5.5" fill="#fff" stroke={NAVY} strokeWidth="2.5" />
      {row.next !== row.now && <circle cx={xAt(index)} cy={yAt(row.next)} r="5.5" fill={PINK} stroke="#fff" strokeWidth="1.5" />}
      {row.next === row.now
        ? <text className="chart-value" x={xAt(index)} y={yAt(row.now) - 12} textAnchor="middle" fill="#5c6078">{row.now === 0 ? "None" : row.now}</text>
        : <>
          <text className="chart-value" x={xAt(index) - 12} y={yAt(row.now) + 4} textAnchor="end" fill={NAVY}>{row.now}</text>
          <text className="chart-value" x={xAt(index) + 12} y={yAt(row.next) - 10} fill={PINK}>{row.next}</text>
        </>}
      <text className="chart-label" x={xAt(index)} y={height - 16} textAnchor="middle">{row.label}</text>
    </g>)}
  </svg>;
}

function amountDraft(value) {
  if (value === "" || value === "0") return true;
  if (!/^\d+(\.\d*)?$/.test(value) || value.startsWith("0")) return false;
  const head = value.endsWith(".") ? value.slice(0, -1) : value;
  return Number(head) >= 1;
}

function amountField(value) {
  return typeof value === "number" ? String(value) : "";
}

function StatedSavingsForm({ stated, onSave }) {
  const [values, setValues] = useState({
    hoursPerMonth: amountField(stated?.hoursPerMonth),
    savingsPerYear: amountField(stated?.savingsPerYear)
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const fields = [
    ["hoursPerMonth", "Time saved", "hours/month"],
    ["savingsPerYear", "Money saved", "£/year"]
  ];
  const save = async (event) => {
    event.preventDefault();
    const payload = {};
    for (const [key] of fields) {
      const raw = values[key].trim();
      if (!raw) {
        payload[key] = null;
        continue;
      }
      const number = Number(raw);
      if (raw !== "0" && (!Number.isFinite(number) || number < 1)) {
        setError("Enter 0, or a number that is at least 1.");
        return;
      }
      payload[key] = raw === "0" ? 0 : Math.round(number * 100) / 100;
    }
    setError("");
    setSaving(true);
    try {
      await onSave(payload);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };
  return <form className="stated-savings" onSubmit={save}>
    {fields.map(([key, label, unit]) => <label key={key}>
      <span>{label}</span>
      <input
        type="number"
        min="0"
        step="1"
        inputMode="numeric"
        value={values[key]}
        aria-label={label}
        onKeyDown={(event) => { if (event.key === "-" || event.key === "e") event.preventDefault(); }}
        onChange={(event) => {
          const next = event.target.value;
          if (!amountDraft(next) && next.length >= values[key].length) return;
          setValues((current) => ({ ...current, [key]: next }));
        }}
      />
      <small>{unit}</small>
    </label>)}
    {error && <p role="alert">{error}</p>}
    <button type="submit" className="button button-secondary" disabled={saving}>{saving ? "Saving…" : "Save amounts"}</button>
  </form>;
}

function SavingBars({ rows }) {
  const summary = rows.map((row) => `${row.label}: ${row.detail}`).join(". ");
  return <div className="saving-chart" role="img" aria-label={`Amounts stated. ${summary}.`}>
    {rows.map((row) => <div className="saving-row" key={`${row.label}-${row.detail}`}>
      <span>{row.label}</span>
      <div><i style={{ width: row.width }} /></div>
      <strong>{row.detail}</strong>
    </div>)}
  </div>;
}

export function BenefitCharts({ benefits, review, statedSavings, onSaveStated }) {
  const source = review?.benefits ?? benefits ?? [];
  const worth = review?.recommendation !== "not_worth_it";
  const rows = worth ? chartRows(source) : noImprovementRows();
  if (worth && !rows.length) return <p className="benefit-note">No potential benefit was described clearly enough to chart.</p>;
  const entered = statedBenefitItems(statedSavings);
  const amounts = entered.length ? savingRows(entered, worth, false) : savingRows(source, worth, !onSaveStated);
  const stated = amounts.some((row) => row.detail !== "None" && row.detail !== "Not stated");

  return <div className="benefit-chart-list">
    <section className="benefit-chart-panel">
      <div className="chart-heading">
        <h3>How well the work would go</h3>
        <div className="compare-legend">
          <span><i className="compare-current" /> Now</span>
          <span><i className="compare-proposed" /> With this opportunity</span>
        </div>
      </div>
      <p className="chart-explainer">
        {worth
          ? "Each point is a different part of the work, scored from 1 to 5. The pink line should sit above the navy line where this opportunity helps."
          : "Each point is a different part of the work. Both lines stay at none because this opportunity would not make the work go better."}
      </p>
      <ComparisonLine rows={rows} />
      <ul className="chart-key">
        {rows.map((row) => <li key={row.label}>
          <i />
          <span>
            <strong>{row.label}</strong>
            <small>
              {row.now === row.next ? row.description : `${row.description}. ${row.now} now, ${row.next} with this opportunity.`}
            </small>
          </span>
        </li>)}
      </ul>
    </section>

    <section className="benefit-chart-panel">
      <div className="chart-heading">
        <h3>What would be saved</h3>
      </div>
      <p className="chart-explainer">
        {!worth
          ? review?.similarTitle
            ? `Nothing extra would be saved. ${review.similarTitle} already covers this work.`
            : "No time or money would be saved."
          : onSaveStated
            ? "Enter 0, or at least 1, for hours and for money."
            : stated
              ? "These are the amounts entered for this opportunity."
              : "No hours or money were entered."}
      </p>
      {worth && onSaveStated && <StatedSavingsForm stated={statedSavings} onSave={onSaveStated} />}
      {amounts.length > 0 && <SavingBars rows={amounts} />}
    </section>
    <p className="benefit-note">The line uses estimates from 1 to 5. The bars use only numbers stated in the opportunity.</p>
  </div>;
}
