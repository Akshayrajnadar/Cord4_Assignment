// Usage: import DataQualityPanel from "@/components/DataQualityPanel"; render <DataQualityPanel cleanReport={cleanReport} hrmsReport={hrmsReport} joinSummary={joinSummary} />.
"use client";

import { useState } from "react";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-IN");
}

function count(value) {
  return asArray(value).length;
}

function Stat({ label, value, tone = "neutral" }) {
  const toneClass = tone === "amber" ? "text-amber-700" : "text-gray-800";

  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-normal text-gray-500">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${toneClass}`}>{formatNumber(value)}</p>
    </div>
  );
}

function BadgeList({ items }) {
  if (!items.length) {
    return <p className="text-xs text-gray-500">None</p>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function SectionCard({ title, children }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <div className="mt-3 space-y-4">{children}</div>
    </section>
  );
}

function LoadingSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="h-4 w-64 max-w-full animate-pulse rounded bg-gray-200" />
    </div>
  );
}

function Chevron({ open }) {
  return (
    <svg
      aria-hidden="true"
      className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
    </svg>
  );
}

function buildSummary(cleanReport, hrmsReport, joinSummary) {
  const totalIn = cleanReport.totalRowsIn || joinSummary.totalActivityRows || 0;
  const dropped = (cleanReport.durationsDropped || 0) + (cleanReport.timestampsUnparseable || 0);
  const fixed = cleanReport.durationsFixed || 0;
  const cleanRows = Math.max(0, totalIn - dropped - (cleanReport.duplicatesRemoved || 0));
  const unmatched =
    (joinSummary.rowsWithoutMetadata || 0) +
    count(joinSummary.employeeIdsWithNoMetadata) +
    (joinSummary.employeesWithNoActivityCount || 0);
  const flagged =
    dropped +
    fixed +
    (cleanReport.duplicatesRemoved || 0) +
    count(cleanReport.unknownEmployeeIds) +
    (cleanReport.repetitiveUnknown || 0) +
    count(hrmsReport.missingDepartment) +
    count(hrmsReport.missingRoleOrTenure) +
    count(hrmsReport.missingCompensation) +
    count(hrmsReport.missingWorkingHours) +
    count(hrmsReport.duplicateEmployeeIds);

  return `Data Quality: ${formatNumber(totalIn)} rows in -> ${formatNumber(cleanRows)} clean (${formatNumber(
    dropped,
  )} dropped, ${formatNumber(fixed)} fixed, ${formatNumber(flagged)} flagged) - ${formatNumber(
    unmatched,
  )} employees unmatched`;
}

export default function DataQualityPanel({ cleanReport, hrmsReport, joinSummary }) {
  const [open, setOpen] = useState(false);

  if (!cleanReport || !hrmsReport || !joinSummary) {
    return <LoadingSkeleton />;
  }

  const summary = buildSummary(cleanReport, hrmsReport, joinSummary);
  const idsWithNoMetadata = asArray(joinSummary.employeeIdsWithNoMetadata);
  const employeesWithNoActivity = asArray(joinSummary.employeesWithNoActivity);

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-700">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="font-medium text-gray-800">{summary}</span>
        <Chevron open={open} />
      </button>

      {open ? (
        <div className="grid gap-3 border-t border-gray-200 p-3 lg:grid-cols-3">
          <SectionCard title="Activity Log Cleaning">
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Total rows in" value={cleanReport.totalRowsIn} />
              <Stat label="Duplicates removed" value={cleanReport.duplicatesRemoved} tone="amber" />
              <Stat label="Durations fixed" value={cleanReport.durationsFixed} tone="amber" />
              <Stat label="Durations dropped" value={cleanReport.durationsDropped} tone="amber" />
              <Stat label="Bad timestamps" value={cleanReport.timestampsUnparseable} tone="amber" />
              <Stat label="Repetitive unknown" value={cleanReport.repetitiveUnknown} tone="amber" />
            </div>

            {count(cleanReport.unknownEmployeeIds) ? (
              <div>
                <p className="mb-2 text-xs font-semibold text-gray-600">Unknown employee IDs</p>
                <BadgeList items={cleanReport.unknownEmployeeIds} />
              </div>
            ) : null}

            {count(cleanReport.flags) ? (
              <ul className="space-y-2">
                {cleanReport.flags.map((flag) => (
                  <li key={flag.type} className="rounded-md bg-gray-50 p-2 text-xs text-gray-600">
                    <span className="font-semibold text-amber-700">{formatNumber(flag.count)}</span>{" "}
                    {flag.description}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-500">No cleaning flags reported.</p>
            )}
          </SectionCard>

          <SectionCard title="HRMS Reconciliation">
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Total records in" value={hrmsReport.totalRecordsIn} />
              <Stat label="Missing department" value={count(hrmsReport.missingDepartment)} tone="amber" />
              <Stat label="Missing role/tenure" value={count(hrmsReport.missingRoleOrTenure)} tone="amber" />
              <Stat label="Missing compensation" value={count(hrmsReport.missingCompensation)} tone="amber" />
              <Stat label="Missing hours" value={count(hrmsReport.missingWorkingHours)} tone="amber" />
            </div>

            {count(hrmsReport.duplicateEmployeeIds) ? (
              <ul className="space-y-2">
                {hrmsReport.duplicateEmployeeIds.map((duplicate) => (
                  <li
                    key={duplicate.employeeId}
                    className="rounded-md border border-amber-100 bg-amber-50 p-2 text-xs text-amber-900"
                  >
                    <span className="font-semibold">{duplicate.employeeId}</span> - {duplicate.resolution}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-500">No duplicate employee IDs reported.</p>
            )}
          </SectionCard>

          <SectionCard title="Join Coverage">
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Total activity rows" value={joinSummary.totalActivityRows} />
              <Stat label="Rows matched" value={joinSummary.rowsWithMetadata} />
              <Stat label="Rows no metadata" value={joinSummary.rowsWithoutMetadata} tone="amber" />
              <Stat
                label="Metadata no activity"
                value={joinSummary.employeesWithNoActivityCount}
                tone="amber"
              />
            </div>

            <details className="rounded-md border border-gray-200 bg-gray-50 p-2">
              <summary className="cursor-pointer text-xs font-semibold text-gray-700">
                Employee IDs with no HRMS metadata
              </summary>
              <div className="mt-2">
                <BadgeList items={idsWithNoMetadata} />
              </div>
            </details>

            <details className="rounded-md border border-gray-200 bg-gray-50 p-2">
              <summary className="cursor-pointer text-xs font-semibold text-gray-700">
                Employees with no logged activity
              </summary>
              <div className="mt-2">
                <BadgeList items={employeesWithNoActivity} />
              </div>
            </details>
          </SectionCard>
        </div>
      ) : null}
    </div>
  );
}
