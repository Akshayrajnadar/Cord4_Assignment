"use client";

const INR_FORMATTER = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function formatPercent(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function Skeleton() {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="h-5 w-56 animate-pulse rounded bg-gray-200" />
      <div className="mt-4 space-y-2">
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="h-10 animate-pulse rounded bg-gray-100" />
        ))}
      </div>
    </section>
  );
}

function PriorityScore({ value }) {
  const width = `${Math.min(100, Math.max(0, Number(value || 0) * 100))}%`;

  return (
    <div className="min-w-36">
      <div className="h-2 rounded-full bg-gray-200">
        <div className="h-2 rounded-full bg-[#2f7d6d]" style={{ width }} />
      </div>
      <p className="mt-1 text-xs font-semibold text-gray-700">{Number(value || 0).toFixed(3)}</p>
    </div>
  );
}

function FormulaTooltip() {
  return (
    <span className="group relative inline-flex align-middle">
      <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 text-[10px] text-gray-600">
        i
      </span>
      <span className="pointer-events-none absolute left-1/2 top-6 z-20 hidden w-72 -translate-x-1/2 rounded-md border border-gray-200 bg-white p-3 text-xs font-normal leading-5 text-gray-700 shadow-lg group-hover:block">
        Score = 30% volume + 25% repetitiveness + 15% concentration + 30% rupee impact.
        Volume and rupee impact are weighted highest because they represent measurable business value.
      </span>
    </span>
  );
}

export default function AutomationRankingTable({ ranking, onRowClick }) {
  if (!ranking) return <Skeleton />;

  return (
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-900">Automation Priority Ranking</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-normal text-gray-500">
            <tr>
              <th className="px-4 py-3">Rank</th>
              <th className="px-4 py-3">Task Category</th>
              <th className="px-4 py-3">
                Priority Score
                <FormulaTooltip />
              </th>
              <th className="px-4 py-3">Volume</th>
              <th className="px-4 py-3">Repetitiveness</th>
              <th className="px-4 py-3">Concentration</th>
              <th className="px-4 py-3">Rupee Impact</th>
              <th className="px-4 py-3">Est. ₹/Month</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((row) => (
              <tr
                key={row.taskCategory}
                onClick={() => onRowClick?.(row.taskCategory)}
                className={`cursor-pointer border-t border-gray-100 transition hover:bg-gray-50 ${
                  row.rank <= 5 ? "bg-amber-50/50" : "bg-white"
                }`}
              >
                <td className="px-4 py-3 font-semibold text-gray-900">#{row.rank}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{row.taskCategory}</span>
                    {row.rawStats.insufficientRepetitiveData ? (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                        limited data
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3"><PriorityScore value={row.priorityScore} /></td>
                <td className="px-4 py-3">{row.rawStats.totalHours.toLocaleString("en-IN")}h</td>
                <td className="px-4 py-3">{formatPercent(row.subScores.repetitivenessScore)}</td>
                <td className="px-4 py-3">{formatPercent(row.subScores.concentrationScore)}</td>
                <td className="px-4 py-3">{formatPercent(row.subScores.rupeeImpactScore)}</td>
                <td className="px-4 py-3 font-semibold text-gray-900">
                  {INR_FORMATTER.format(row.rawStats.recoverableRupeesPerMonth)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}