export default function HeadlineNumbers({ metrics }) {
  const cards = [
    ["Employees", metrics.totalEmployees],
    ["Sessions", metrics.totalSessions],
    ["Active hours", metrics.totalHours],
    ["HRMS match", `${metrics.hrmsMatchRate}%`],
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(([label, value]) => (
        <div key={label} className="rounded-lg border border-[#d7d0c4] bg-white p-4 shadow-sm">
          <p className="text-sm text-[#6b655c]">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-[#1f2933]">{value}</p>
        </div>
      ))}
    </section>
  );
}
