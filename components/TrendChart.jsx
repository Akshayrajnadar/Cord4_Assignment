"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function DirectionIcon({ direction }) {
  const path = direction === "increasing" ? "M12 19V5m0 0-6 6m6-6 6 6" : direction === "decreasing" ? "M12 5v14m0 0-6-6m6 6 6-6" : "M5 12h14";
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

function TooltipContent({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-md border border-gray-200 bg-white p-3 text-xs shadow-lg">
      <p className="font-semibold text-gray-900">{item.weekLabel}</p>
      <p className="mt-1 text-gray-600">Repetitive share: {item.repetitiveSharePercent}%</p>
      <p className="text-gray-600">Total hours: {item.totalHours}</p>
      <p className="text-gray-600">Rows included: {item.rowsIncluded}</p>
    </div>
  );
}

function badgeText(trendDirection) {
  const delta = Math.abs(trendDirection?.deltaPercentPoints || 0).toFixed(1);
  if (trendDirection?.direction === "increasing") return `Repetitive-task share rose ${delta} points over the period`;
  if (trendDirection?.direction === "decreasing") return `Repetitive-task share fell ${delta} points over the period`;
  return `Repetitive-task share stayed flat over the period`;
}

export default function TrendChart({ trends, trendDirection }) {
  if (!trends) {
    return (
      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="h-5 w-48 animate-pulse rounded bg-gray-200" />
        <div className="mt-5 h-64 animate-pulse rounded bg-gray-100" />
      </section>
    );
  }

  if (trends.length < 2 || trends.every((trend) => trend.rowsIncluded === 0)) {
    return (
      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Weekly Repetitive Share</h2>
        <p className="mt-4 rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">
          Not enough weeks of data for a trend
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Weekly Repetitive Share</h2>
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
          <DirectionIcon direction={trendDirection?.direction} />
          {badgeText(trendDirection)}
        </span>
      </div>
      <div className="mt-5 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trends} margin={{ top: 8, right: 24, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="weekLabel" tick={{ fontSize: 12 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} tickFormatter={(value) => `${value}%`} />
            <Tooltip content={<TooltipContent />} />
            <Line type="monotone" dataKey="repetitiveSharePercent" stroke="#315f72" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}