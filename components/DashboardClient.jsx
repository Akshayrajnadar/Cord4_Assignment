"use client";

import { useMemo, useState } from "react";
import AnomalyCallout from "@/components/AnomalyCallout";
import AutomationRankingTable from "@/components/AutomationRankingTable";
import BreakdownView from "@/components/BreakdownView";
import ChatAssistant from "@/components/ChatAssistant";
import EmployeeDrilldown from "@/components/EmployeeDrilldown";
import ExportButton from "@/components/ExportButton";
import HeadlineNumbers from "@/components/HeadlineNumbers";
import TrendChart from "@/components/TrendChart";
import { detectAnomalies } from "@/lib/anomalies";
import { computeHeadlineNumbers } from "@/lib/metrics";
import { computeAutomationRanking } from "@/lib/ranking";
import { computeWeeklyRepetitiveShare } from "@/lib/trends";

function departmentFor(row) {
  return row.department || row.employee?.department || "Unknown";
}

function categoryFor(row) {
  return row.task_category || row.category || "Uncategorized";
}

function matchesFilter(value, filter) {
  if (!filter) return true;
  return String(value || "").trim().toLowerCase() === String(filter).trim().toLowerCase();
}


function dateRangeFor(rows) {
  const dates = rows
    .map((row) => row.timestamp_iso || row.timestamp || row.date)
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()));

  if (!dates.length) return { start: null, end: null };

  return {
    start: new Date(Math.min(...dates.map((date) => date.getTime()))).toISOString(),
    end: new Date(Math.max(...dates.map((date) => date.getTime()))).toISOString(),
  };
}
function FilterChip({ label, value, onClear }) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900"
    >
      <span>
        {label}: {value}
      </span>
      <span aria-hidden="true">x</span>
    </button>
  );
}

export default function DashboardClient({ dataset }) {
  const [activeDepartment, setActiveDepartment] = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);
  const joinedRows = useMemo(() => dataset.rows || [], [dataset.rows]);
  const employees = useMemo(() => dataset.employees || [], [dataset.employees]);

  const filteredRows = useMemo(
    () =>
      joinedRows.filter(
        (row) =>
          matchesFilter(departmentFor(row), activeDepartment) &&
          matchesFilter(categoryFor(row), activeCategory),
      ),
    [joinedRows, activeDepartment, activeCategory],
  );

  const headlineMetrics = useMemo(() => computeHeadlineNumbers(filteredRows), [filteredRows]);
  const ranking = useMemo(() => computeAutomationRanking(filteredRows), [filteredRows]);
  const trendResult = useMemo(() => computeWeeklyRepetitiveShare(filteredRows), [filteredRows]);
  const anomaly = useMemo(() => detectAnomalies(filteredRows, employees), [filteredRows, employees]);
  const dateRange = useMemo(() => dateRangeFor(filteredRows), [filteredRows]);

  // Department filters narrow aggregate views. Category filters narrow the employee list,
  // and combine with department only when both filters are active.
  const employeeOptionRows = useMemo(() => {
    if (!activeCategory) return joinedRows;
    return joinedRows.filter(
      (row) =>
        matchesFilter(categoryFor(row), activeCategory) &&
        matchesFilter(departmentFor(row), activeDepartment),
    );
  }, [joinedRows, activeCategory, activeDepartment]);

  function handleBreakdownBarClick(value, groupBy) {
    if (groupBy !== "department") return;
    setActiveDepartment((current) => (current === value ? null : value));
  }

  function handleRankingRowClick(taskCategory) {
    setActiveCategory((current) => (current === taskCategory ? null : taskCategory));
  }

  const hasFilters = activeDepartment || activeCategory;

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-[#1d1d1b]">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-[#d7d0c4] pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#7b5f32]">
              HRMS Activity Intelligence
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-[#1f2933] md:text-4xl">
              Workforce Usage Dashboard
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5f5b53]">
              Cleaned application logs reconciled with HRMS employee records.
            </p>
          </div>
          <ExportButton
            headlineMetrics={headlineMetrics}
            ranking={ranking}
            dateRange={dateRange}
            activeDepartment={activeDepartment}
            activeCategory={activeCategory}
          />
        </header>

        {hasFilters ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-white p-3 text-sm shadow-sm">
            {activeDepartment ? (
              <FilterChip
                label="Department"
                value={activeDepartment}
                onClear={() => setActiveDepartment(null)}
              />
            ) : null}
            {activeCategory ? (
              <FilterChip label="Category" value={activeCategory} onClear={() => setActiveCategory(null)} />
            ) : null}
            {activeDepartment && activeCategory ? (
              <button
                type="button"
                onClick={() => {
                  setActiveDepartment(null);
                  setActiveCategory(null);
                }}
                className="text-xs font-semibold text-gray-600 underline-offset-2 hover:underline"
              >
                Clear all
              </button>
            ) : null}
          </div>
        ) : null}

        <HeadlineNumbers metrics={headlineMetrics} />
        <AnomalyCallout anomaly={anomaly} />

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <TrendChart trends={trendResult.trends} trendDirection={trendResult.trendDirection} />
          <BreakdownView
            joinedRows={joinedRows}
            activeDepartmentFilter={activeDepartment}
            activeCategoryFilter={activeCategory}
            onBarClick={handleBreakdownBarClick}
          />
        </div>

        <AutomationRankingTable ranking={ranking} onRowClick={handleRankingRowClick} />

        <EmployeeDrilldown
          joinedRows={joinedRows}
          employeeOptionRows={employeeOptionRows}
          employees={employees}
          filterEmployeeOptionsToRows={Boolean(activeCategory)}
        />

        <ChatAssistant />
      </section>
    </main>
  );
}