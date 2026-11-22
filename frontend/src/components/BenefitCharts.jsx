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

function ComparisonLine({ rows }) {
  const width = 720;
  const height = 320;
  const pad = { l: 56, r: 36, t: 36, b: 52 };
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
    {rows.map((row, index) => <g key={`${row.category}-${row.description}`}>
      <circle cx={xAt(index)} cy={yAt(row.now)} r="5.5" fill="#fff" stroke={NAVY} strokeWidth="2.5" />
      <circle cx={xAt(index)} cy={yAt(row.next)} r="5.5" fill={PINK} stroke="#fff" strokeWidth="1.5" />
      <text className="chart-value chart-value-now" x={xAt(index) - 12} y={yAt(row.now) + 4} textAnchor="end">{row.now}</text>
      <text className="chart-value chart-value-next" x={xAt(index) + 12} y={yAt(row.next) - 10}>{row.next}</text>
      <text className="chart-label" x={xAt(index)} y={height - 16} textAnchor="middle">{row.label}</text>
    </g>)}
  </svg>;
}

export function BenefitCharts({ benefits }) {
  const rows = chartRows(benefits);
  if (!rows.length) return <p className="benefit-note">No potential benefit was described clearly enough to chart.</p>;
  return <div className="benefit-chart-list">
    <section className="benefit-chart-panel">
      <div className="chart-heading">
        <h3>How well the work would go</h3>
        <div className="compare-legend">
          <span><i className="compare-current" /> Now</span>
          <span><i className="compare-proposed" /> With this opportunity</span>
        </div>
      </div>
      <p className="chart-explainer">The line compares measures such as efficiency, time saving and service. Higher means that part of the work would go better.</p>
      <ComparisonLine rows={rows} />
      <ul className="chart-key">
        {rows.map((row) => <li key={`${row.category}-${row.description}`}>
          <i />
          <span>
            <strong>{row.label}</strong>
            <small>{row.description}. {row.now} now, {row.next} with this opportunity.</small>
          </span>
        </li>)}
      </ul>
    </section>
    <p className="benefit-note">Scores are estimates from 1 to 5, not measured results.</p>
  </div>;
}
