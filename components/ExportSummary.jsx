const INR_FORMATTER = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const DATE_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatDate(value) {
  if (!value) return "Unknown";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : DATE_FORMATTER.format(date);
}

function formatDateTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : DATE_TIME_FORMATTER.format(date);
}

function scopeText(activeDepartment, activeCategory) {
  if (activeDepartment && activeCategory) return `Filtered to: ${activeDepartment} - ${activeCategory}`;
  if (activeDepartment) return `Filtered to: ${activeDepartment} department`;
  if (activeCategory) return `Filtered to: ${activeCategory} category`;
  return "All departments, all categories";
}

function StatBlock({ label, value, note }) {
  return (
    <div style={{ border: "1px solid #d1d5db", background: "#f9fafb", padding: 20 }}>
      <p style={{ margin: 0, color: "#111827", fontSize: 38, lineHeight: 1.1, fontWeight: 800 }}>{value}</p>
      <p style={{ margin: "10px 0 0", color: "#111827", fontSize: 14, fontWeight: 700 }}>{label}</p>
      <p style={{ margin: "4px 0 0", color: "#4b5563", fontSize: 12, lineHeight: 1.6 }}>{note}</p>
    </div>
  );
}

export default function ExportSummary({
  headlineMetrics,
  ranking,
  dateRange,
  activeDepartment,
  activeCategory,
  generatedAt,
}) {
  const methodology = headlineMetrics?.methodology || {};
  const repetitiveRows = Number(methodology.totalRepetitiveRows || 0).toLocaleString("en-IN");
  const recoveryRate = Math.round(Number(methodology.automationRecoveryRate || 0) * 100);
  const topRows = (ranking || []).slice(0, 5);

  return (
    <div
      style={{
        width: 800,
        boxSizing: "border-box",
        background: "#ffffff",
        color: "#111827",
        padding: 40,
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <header style={{ borderBottom: "1px solid #d1d5db", paddingBottom: 20 }}>
        <p style={{ margin: 0, color: "#6b7280", fontSize: 12, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase" }}>
          Workforce Pulse
        </p>
        <h1 style={{ margin: "8px 0 0", color: "#111827", fontSize: 30, lineHeight: 1.2, fontWeight: 800 }}>
          Workforce Pulse - Executive Summary
        </h1>
        <p style={{ margin: "12px 0 0", color: "#374151", fontSize: 14 }}>
          Date range: {formatDate(dateRange?.start)} to {formatDate(dateRange?.end)} - {scopeText(activeDepartment, activeCategory)}
        </p>
        <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 12 }}>Generated {formatDateTime(generatedAt)}</p>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 32 }}>
        <StatBlock
          label="Hours/Month Recoverable"
          value={(headlineMetrics?.recoverableHoursPerMonth || 0).toLocaleString("en-IN", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          })}
          note={`Based on ${repetitiveRows} repetitive-task rows and a ${recoveryRate}% automation-recovery assumption.`}
        />
        <StatBlock
          label="INR/Month Recoverable"
          value={INR_FORMATTER.format(headlineMetrics?.recoverableINRPerMonth || 0)}
          note={`Uses compensation-backed rows and ${Number(methodology.minutesPerWorkingMonth || 0).toLocaleString("en-IN")} working minutes/month.`}
        />
      </section>

      <section style={{ marginTop: 36 }}>
        <h2 style={{ margin: 0, color: "#111827", fontSize: 18, fontWeight: 800 }}>Top 5 Automation Opportunities</h2>
        <table style={{ marginTop: 16, width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "#f3f4f6", color: "#374151" }}>
              <th style={{ border: "1px solid #d1d5db", padding: "8px 12px" }}>Rank</th>
              <th style={{ border: "1px solid #d1d5db", padding: "8px 12px" }}>Task Category</th>
              <th style={{ border: "1px solid #d1d5db", padding: "8px 12px" }}>Priority Score</th>
              <th style={{ border: "1px solid #d1d5db", padding: "8px 12px" }}>Est. INR/Month</th>
            </tr>
          </thead>
          <tbody>
            {topRows.length ? (
              topRows.map((row) => (
                <tr key={row.taskCategory}>
                  <td style={{ border: "1px solid #d1d5db", padding: "8px 12px", fontWeight: 700 }}>#{row.rank}</td>
                  <td style={{ border: "1px solid #d1d5db", padding: "8px 12px" }}>{row.taskCategory}</td>
                  <td style={{ border: "1px solid #d1d5db", padding: "8px 12px" }}>{Number(row.priorityScore || 0).toFixed(3)}</td>
                  <td style={{ border: "1px solid #d1d5db", padding: "8px 12px", fontWeight: 700 }}>
                    {INR_FORMATTER.format(row.rawStats?.recoverableRupeesPerMonth || 0)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td style={{ border: "1px solid #d1d5db", padding: 12, color: "#6b7280" }} colSpan="4">
                  No automation opportunities available for this scope.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <footer style={{ marginTop: 40, borderTop: "1px solid #d1d5db", paddingTop: 16, color: "#6b7280", fontSize: 12 }}>
        Generated by Workforce Pulse
      </footer>
    </div>
  );
}