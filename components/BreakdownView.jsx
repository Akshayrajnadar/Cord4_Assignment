"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const GROUP_OPTIONS = [
  { key: "category", label: "By Category", field: "task_category" },
  { key: "app", label: "By App", field: "app_used" },
  { key: "department", label: "By Department", field: "department" },
];

function valueFor(row, field) {
  if (field === "department") return row.department || row.employee?.department || "Unknown";
  return row[field] || "Uncategorized";
}

function durationFor(row) {
  const parsed = Number(row.duration_minutes ?? row.durationMinutes ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function matchesFilter(value, filter) {
  if (!filter) return true;
  return String(value || "").trim().toLowerCase() === String(filter).trim().toLowerCase();
}

function aggregateRows(rows, groupBy, activeDepartmentFilter, activeCategoryFilter) {
  const option = GROUP_OPTIONS.find((item) => item.key === groupBy) || GROUP_OPTIONS[0];
  const buckets = new Map();

  for (const row of rows) {
    const department = valueFor(row, "department");
    const category = valueFor(row, "task_category");

    if (!matchesFilter(department, activeDepartmentFilter)) continue;
    if (!matchesFilter(category, activeCategoryFilter)) continue;

    const name = valueFor(row, option.field);
    const bucket = buckets.get(name) || {
      name,
      minutes: 0,
      hours: 0,
      rowCount: 0,
      repetitiveKnownRows: 0,
      repetitiveTrueRows: 0,
    };

    bucket.minutes += durationFor(row);
    bucket.rowCount += 1;
    if (row.is_repetitive === true || row.is_repetitive === false) {
      bucket.repetitiveKnownRows += 1;
      if (row.is_repetitive === true) bucket.repetitiveTrueRows += 1;
    }

    buckets.set(name, bucket);
  }

  return [...buckets.values()]
    .map((bucket) => ({
      ...bucket,
      hours: Number((bucket.minutes / 60).toFixed(1)),
      repetitivePercent: bucket.repetitiveKnownRows
        ? Number(((bucket.repetitiveTrueRows / bucket.repetitiveKnownRows) * 100).toFixed(1))
        : 0,
    }))
    .sort((a, b) => b.minutes - a.minutes);
}

function Skeleton() {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="h-5 w-52 animate-pulse rounded bg-gray-200" />
      <div className="mt-5 h-72 animate-pulse rounded bg-gray-100" />
    </section>
  );
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;

  return (
    <div className="rounded-md border border-gray-200 bg-white p-3 text-xs shadow-lg">
      <p className="font-semibold text-gray-900">{item.name}</p>
      <p className="mt-1 text-gray-600">Total hours: {item.hours.toLocaleString("en-IN")}</p>
      <p className="text-gray-600">Rows: {item.rowCount.toLocaleString("en-IN")}</p>
      <p className="text-gray-600">Repetitive: {item.repetitivePercent}%</p>
    </div>
  );
}

export default function BreakdownView({
  joinedRows,
  activeDepartmentFilter = null,
  activeCategoryFilter = null,
  onBarClick,
}) {
  const [groupBy, setGroupBy] = useState("category");
  const allGroups = useMemo(
    () => aggregateRows(joinedRows || [], groupBy, activeDepartmentFilter, activeCategoryFilter),
    [joinedRows, groupBy, activeDepartmentFilter, activeCategoryFilter],
  );
  const chartData = allGroups.slice(0, 10).reverse();
  const hiddenCount = Math.max(0, allGroups.length - 10);

  if (!joinedRows) return <Skeleton />;

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Time Breakdown</h2>
        <div className="flex flex-wrap gap-2">
          {GROUP_OPTIONS.map((option) => {
            const active = option.key === groupBy;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setGroupBy(option.key)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "border-[#315f72] bg-[#315f72] text-white"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 24, bottom: 16, left: 24 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
            <XAxis type="number" dataKey="hours" tick={{ fontSize: 12 }} label={{ value: "Total hours", position: "insideBottom", offset: -8 }} />
            <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey="hours"
              fill="#315f72"
              radius={[0, 4, 4, 0]}
              cursor="pointer"
              onClick={(data) => onBarClick?.(data.name)}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex flex-col gap-1 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
        <p>Repetitive % excludes rows with unknown repetitive status.</p>
        {hiddenCount ? <p>+{hiddenCount.toLocaleString("en-IN")} more categories not shown</p> : null}
      </div>
    </section>
  );
}