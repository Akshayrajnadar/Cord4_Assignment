export default function TrendChart({ trends }) {
  const max = Math.max(...trends.map((trend) => trend.minutes), 1);

  return (
    <section className="rounded-lg border border-[#d7d0c4] bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-[#1f2933]">Daily Activity Trend</h2>
      <div className="mt-6 flex h-64 items-end gap-3">
        {trends.map((trend) => (
          <div key={trend.date} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
            <div
              className="w-full rounded-t-md bg-[#315f72]"
              style={{ height: `${Math.max(8, (trend.minutes / max) * 100)}%` }}
              title={`${trend.date}: ${trend.minutes} minutes`}
            />
            <span className="text-xs text-[#6b655c]">{trend.date.slice(5)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
