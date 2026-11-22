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

function savingRows(benefits, worth) {
  const blank = (detail) => [
    { label: "Time saved", detail, width: "0%" },
    { label: "Cases avoided", detail, width: "0%" },
    { label: "Money saved", detail, width: "0%" }
  ];
  if (!worth) return blank("None");
  const stated = (benefits ?? []).filter((item) => typeof item.estimated === "number" && item.estimated > 0);
  if (!stated.length) return blank("Not stated");
  const maxByUnit = {};
  for (const item of stated) maxByUnit[item.unit] = Math.max(maxByUnit[item.unit] ?? 0, item.estimated);
  const rows = stated.map((item) => ({
    label: savingName(item),
    detail: amountLabel(item),
    width: `${Math.max((item.estimated / maxByUnit[item.unit]) * 100, 12)}%`
  }));
  if (!stated.some((item) => item.unit === "GBP/year" || item.category === "financial")) {
    rows.push({ label: "Money saved", detail: "Not stated", width: "0%" });
  }
  return rows;
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

export function BenefitCharts({ benefits, review }) {
  const source = review?.benefits ?? benefits ?? [];
  const worth = review?.recommendation !== "not_worth_it";
  const rows = worth ? chartRows(source) : noImprovementRows();
  if (worth && !rows.length) return <p className="benefit-note">No potential benefit was described clearly enough to chart.</p>;
  const amounts = savingRows(source, worth);
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
            : "No time, cases or money would be saved."
          : stated
            ? "These are amounts written in the opportunity. They are counted savings, not the scores in the line chart. Money appears only when an amount is stated."
            : "No hours, cases or money were stated. The line chart is what shows the improvement."}
      </p>
      <SavingBars rows={amounts} />
    </section>
    <p className="benefit-note">The line uses estimates from 1 to 5. The bars use only numbers stated in the opportunity.</p>
  </div>;
}
