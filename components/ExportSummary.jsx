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
  if (activeDepartment && activeCategory) return `Filtered to: ${activeDepartment} · ${activeCategory}`;
  if (activeDepartment) return `Filtered to: ${activeDepartment} department`;
  if (activeCategory) return `Filtered to: ${activeCategory} category`;
  return "All departments, all categories";
}

function StatBlock({ label, value, note }) {
  return (
    <div className="border border-gray-300 bg-gray-50 p-5">
      <p className="text-4xl font-bold text-gray-950">{value}</p>
      <p className="mt-2 text-sm font-semibold text-gray-900">{label}</p>
      <p className="mt-1 text-xs leading-5 text-gray-600">{note}</p>
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
    <div className="w-[800px] bg-white p-10 text-gray-950">
      <header className="border-b border-gray-300 pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Workforce Pulse</p>
        <h1 className="mt-2 text-3xl font-bold text-gray-950">Workforce Pulse — Executive Summary</h1>
        <p className="mt-3 text-sm text-gray-700">
          Date range: {formatDate(dateRange?.start)} to {formatDate(dateRange?.end)} · {scopeText(activeDepartment, activeCategory)}
        </p>
        <p className="mt-1 text-xs text-gray-500">Generated {formatDateTime(generatedAt)}</p>
      </header>

      <section className="mt-8 grid grid-cols-2 gap-5">
        <StatBlock
          label="Hours/Month Recoverable"
          value={(headlineMetrics?.recoverableHoursPerMonth || 0).toLocaleString("en-IN", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          })}
          note={`Based on ${repetitiveRows} repetitive-task rows and a ${recoveryRate}% automation-recovery assumption.`}
        />
        <StatBlock
          label="₹/Month Recoverable"
          value={INR_FORMATTER.format(headlineMetrics?.recoverableINRPerMonth || 0)}
          note={`Uses compensation-backed rows and ${Number(methodology.minutesPerWorkingMonth || 0).toLocaleString("en-IN")} working minutes/month.`}
        />
      </section>

      <section className="mt-9">
        <h2 className="text-lg font-bold text-gray-950">Top 5 Automation Opportunities</h2>
        <table className="mt-4 w-full border-collapse text-left text-sm">
          <thead>
            <tr className="bg-gray-100 text-gray-700">
              <th className="border border-gray-300 px-3 py-2">Rank</th>
              <th className="border border-gray-300 px-3 py-2">Task Category</th>
              <th className="border border-gray-300 px-3 py-2">Priority Score</th>
              <th className="border border-gray-300 px-3 py-2">Est. ₹/Month</th>
            </tr>
          </thead>
          <tbody>
            {topRows.length ? (
              topRows.map((row) => (
                <tr key={row.taskCategory}>
                  <td className="border border-gray-300 px-3 py-2 font-semibold">#{row.rank}</td>
                  <td className="border border-gray-300 px-3 py-2">{row.taskCategory}</td>
                  <td className="border border-gray-300 px-3 py-2">{Number(row.priorityScore || 0).toFixed(3)}</td>
                  <td className="border border-gray-300 px-3 py-2 font-semibold">
                    {INR_FORMATTER.format(row.rawStats?.recoverableRupeesPerMonth || 0)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="border border-gray-300 px-3 py-3 text-gray-500" colSpan="4">
                  No automation opportunities available for this scope.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <footer className="mt-10 border-t border-gray-300 pt-4 text-xs text-gray-500">
        Generated by Workforce Pulse
      </footer>
    </div>
  );
}