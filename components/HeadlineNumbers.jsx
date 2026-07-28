"use client";

import { useState } from "react";

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

function formatDate(value) {
  if (!value) return "unknown";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "unknown" : DATE_FORMATTER.format(date);
}

function Skeleton() {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      {[0, 1].map((item) => (
        <div key={item} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
          <div className="mt-5 h-9 w-28 animate-pulse rounded bg-gray-200" />
        </div>
      ))}
    </section>
  );
}

function InfoButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md px-2 py-1 text-xs font-medium text-[#315f72] hover:bg-[#edf4f6]"
    >
      How is this calculated?
    </button>
  );
}

function StatCard({ label, value, onExplain }) {
  return (
    <article className="relative rounded-lg border border-[#d7d0c4] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-[#5f5b53]">{label}</p>
        <InfoButton onClick={onExplain} />
      </div>
      <p className="mt-4 text-4xl font-bold tracking-normal text-[#1f2933]">{value}</p>
    </article>
  );
}

function MethodologyText({ metrics, type }) {
  const methodology = metrics.methodology;
  const start = formatDate(methodology.dateRangeCovered.start);
  const end = formatDate(methodology.dateRangeCovered.end);
  const percent = Math.round(methodology.automationRecoveryRate * 100);

  return (
    <div className="space-y-3 text-sm leading-6 text-gray-700">
      <p>
        We looked at {methodology.totalRepetitiveRows.toLocaleString("en-IN")} repetitive-task rows
        across {methodology.weeksCovered.toLocaleString("en-IN")} week
        {methodology.weeksCovered === 1 ? "" : "s"} ({start}-{end}).
      </p>
      <p>
        We assume {percent}% of repetitive time is realistically automatable. This is a planning
        assumption, so the remaining {100 - percent}% stays human-owned even when the task is
        repetitive.
      </p>
      <p>
        {methodology.rowsExcludedUnknownRepetitive.toLocaleString("en-IN")} rows were excluded
        because repetitive status was unknown. We do not guess on unlabeled rows.
      </p>
      {type === "rupees" ? (
        <p>
          {methodology.rowsExcludedNoCompensation.toLocaleString("en-IN")} repetitive rows were
          excluded from the rupee figure because there was no employee compensation data. Hours and
          rupees can have different denominators because hours do not require salary data.
        </p>
      ) : null}
      <p>
        The monthly normalization uses 4.33 weeks per month, from 52 weeks divided by 12 months.
        The rupee rate uses {methodology.minutesPerWorkingMonth.toLocaleString("en-IN")} working
        minutes per month.
      </p>
    </div>
  );
}

function AuditTable({ rows, totalCount }) {
  const visibleRows = rows.slice(0, 20);
  const remaining = Math.max(0, totalCount - visibleRows.length);

  return (
    <details className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <summary className="cursor-pointer text-sm font-semibold text-gray-800">
        Raw contributing rows
      </summary>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-xs">
          <thead className="text-gray-500">
            <tr>
              <th className="px-2 py-2">Employee</th>
              <th className="px-2 py-2">Department</th>
              <th className="px-2 py-2">Task</th>
              <th className="px-2 py-2">Minutes</th>
              <th className="px-2 py-2">Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, index) => (
              <tr key={`${row.employee_id}-${row.timestamp}-${index}`} className="border-t border-gray-200">
                <td className="px-2 py-2">{row.employee_id || "Unknown"}</td>
                <td className="px-2 py-2">{row.department || "Unknown"}</td>
                <td className="px-2 py-2">{row.task_category || "Uncategorized"}</td>
                <td className="px-2 py-2">{row.duration_minutes}</td>
                <td className="px-2 py-2">{row.timestamp || "Unknown"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {remaining ? <p className="mt-2 text-xs text-gray-500">+{remaining} more rows</p> : null}
      </div>
    </details>
  );
}

function MethodologyModal({ metrics, type, onClose }) {
  const isRupees = type === "rupees";
  const title = isRupees ? "INR/Month Recoverable" : "Hours/Month Recoverable";
  const rows = isRupees
    ? metrics.auditTrail.rupeesContributingRows
    : metrics.auditTrail.hoursContributingRows;
  const totalCount = isRupees
    ? metrics.auditTrail.rupeesContributingRowsTotalCount
    : metrics.auditTrail.hoursContributingRowsTotalCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 pb-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-normal text-gray-500">
              Methodology
            </p>
            <h2 className="mt-1 text-xl font-semibold text-gray-900">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Close
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <MethodologyText metrics={metrics} type={type} />
          <AuditTable rows={rows} totalCount={totalCount} />
        </div>
      </div>
    </div>
  );
}

export default function HeadlineNumbers({ metrics }) {
  const [modal, setModal] = useState(null);

  if (!metrics) {
    return <Skeleton />;
  }

  return (
    <>
      <section className="grid gap-4 md:grid-cols-2">
        <StatCard
          label="Hours/Month Recoverable"
          value={metrics.recoverableHoursPerMonth.toLocaleString("en-IN", {
            maximumFractionDigits: 1,
            minimumFractionDigits: 1,
          })}
          onExplain={() => setModal("hours")}
        />
        <StatCard
          label="₹/Month Recoverable"
          value={INR_FORMATTER.format(metrics.recoverableINRPerMonth)}
          onExplain={() => setModal("rupees")}
        />
      </section>

      {modal ? <MethodologyModal metrics={metrics} type={modal} onClose={() => setModal(null)} /> : null}
    </>
  );
}