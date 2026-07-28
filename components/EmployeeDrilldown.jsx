"use client";

import { useMemo, useState } from "react";

function employeeIdFor(row) {
  return String(row.employee_id ?? row.employeeId ?? "").trim().toUpperCase();
}

function durationFor(row) {
  const minutes = Number(row.duration_minutes ?? row.durationMinutes ?? 0);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
}

function roleFor(employee) {
  return employee?.role || null;
}

function departmentFor(row, employee) {
  return employee?.department || row?.department || "Unknown";
}

function formatHours(minutes) {
  return `${(minutes / 60).toFixed(1)}h`;
}

function repetitiveShare(rows) {
  const known = rows.filter((row) => row.is_repetitive === true || row.is_repetitive === false);
  if (!known.length) return 0;
  return (known.filter((row) => row.is_repetitive === true).length / known.length) * 100;
}

function employeeLabel(employee, hasMetadata) {
  if (!hasMetadata) return `${employee.employeeId} (no metadata)`;
  const role = roleFor(employee);
  return role ? `${employee.employeeId} - ${role}` : employee.employeeId;
}

function buildEmployeeOptions(joinedRows, employees) {
  const byId = new Map();

  for (const employee of employees || []) {
    byId.set(employee.employeeId, { ...employee, hasMetadata: true });
  }

  for (const row of joinedRows || []) {
    const employeeId = employeeIdFor(row);
    if (employeeId && !byId.has(employeeId)) {
      byId.set(employeeId, { employeeId, hasMetadata: false });
    }
  }

  return [...byId.values()].sort((a, b) => a.employeeId.localeCompare(b.employeeId));
}

function topCategories(rows) {
  const buckets = new Map();
  for (const row of rows) {
    const category = row.task_category || row.category || "Uncategorized";
    buckets.set(category, (buckets.get(category) || 0) + durationFor(row));
  }
  return [...buckets.entries()]
    .map(([category, minutes]) => ({ category, minutes }))
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 5);
}

function employeeStats(rows) {
  const totalMinutes = rows.reduce((sum, row) => sum + durationFor(row), 0);
  const repetitiveMinutes = rows.reduce(
    (sum, row) => sum + (row.is_repetitive === true ? durationFor(row) : 0),
    0,
  );

  return {
    totalMinutes,
    repetitiveMinutes,
    repetitiveSharePercent: repetitiveShare(rows),
  };
}

function peerComparison(selectedEmployee, selectedRows, allRows, employeesById) {
  const selectedRole = roleFor(selectedEmployee);
  const selectedDepartment = selectedEmployee?.department || selectedRows[0]?.department || null;
  const mode = selectedRole ? "role" : "department";
  const label = selectedRole || selectedDepartment;

  if (!label) return { mode, label: "Unknown", peers: [] };

  const peerIds = new Set();
  for (const row of allRows) {
    const employeeId = employeeIdFor(row);
    if (!employeeId || employeeId === selectedEmployee.employeeId) continue;

    const employee = employeesById.get(employeeId) || row.employee;
    const matches = mode === "role" ? roleFor(employee) === label : departmentFor(row, employee) === label;
    if (matches) peerIds.add(employeeId);
  }

  const peerStats = [...peerIds].map((employeeId) => {
    const rows = allRows.filter((row) => employeeIdFor(row) === employeeId);
    return employeeStats(rows);
  });

  return { mode, label, peers: peerStats };
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function Skeleton() {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="h-5 w-56 animate-pulse rounded bg-gray-200" />
      <div className="mt-4 h-44 animate-pulse rounded bg-gray-100" />
    </section>
  );
}

export default function EmployeeDrilldown({ joinedRows, employees, initialEmployeeId }) {
  const [selectedId, setSelectedId] = useState(initialEmployeeId || "");

  const options = useMemo(() => buildEmployeeOptions(joinedRows, employees), [joinedRows, employees]);
  const employeesById = useMemo(
    () => new Map((employees || []).map((employee) => [employee.employeeId, employee])),
    [employees],
  );
  const activeId = selectedId || options[0]?.employeeId || "";
  const selectedEmployee = employeesById.get(activeId) || options.find((employee) => employee.employeeId === activeId);
  const selectedRows = (joinedRows || []).filter((row) => employeeIdFor(row) === activeId);
  const stats = employeeStats(selectedRows);
  const categories = topCategories(selectedRows);
  const maxCategoryMinutes = Math.max(...categories.map((category) => category.minutes), 1);
  const comparison = peerComparison(selectedEmployee || { employeeId: activeId }, selectedRows, joinedRows || [], employeesById);
  const peerAverageShare = average(comparison.peers.map((peer) => peer.repetitiveSharePercent));
  const peerAverageHours = average(comparison.peers.map((peer) => peer.totalMinutes / 60));

  if (!joinedRows || !employees) return <Skeleton />;

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Employee Drilldown</h2>
        <select
          className="min-h-10 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-800"
          value={activeId}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          {options.map((employee) => (
            <option key={employee.employeeId} value={employee.employeeId}>
              {employeeLabel(employee, employee.hasMetadata)}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-5 rounded-lg bg-gray-50 p-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <p className="text-xs text-gray-500">Employee</p>
            <p className="font-semibold text-gray-900">{activeId || "-"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Department</p>
            <p className="font-semibold text-gray-900">{selectedEmployee?.department || "-"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Role</p>
            <p className="font-semibold text-gray-900">{selectedEmployee?.role || "-"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Tenure</p>
            <p className="font-semibold text-gray-900">{selectedEmployee?.tenure ?? "-"}</p>
          </div>
        </div>
      </div>

      {!selectedRows.length ? (
        <p className="mt-5 rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">
          No activity rows found for this employee in the selected period.
        </p>
      ) : (
        <div className="mt-5 space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-gray-200 p-3">
              <p className="text-xs text-gray-500">Total hours</p>
              <p className="mt-1 text-lg font-semibold">{formatHours(stats.totalMinutes)}</p>
            </div>
            <div className="rounded-md border border-gray-200 p-3">
              <p className="text-xs text-gray-500">Repetitive hours</p>
              <p className="mt-1 text-lg font-semibold">{formatHours(stats.repetitiveMinutes)}</p>
            </div>
            <div className="rounded-md border border-gray-200 p-3">
              <p className="text-xs text-gray-500">Repetitive share</p>
              <p className="mt-1 text-lg font-semibold">{stats.repetitiveSharePercent.toFixed(1)}%</p>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-normal text-gray-500">Top tasks</h3>
            <div className="mt-3 space-y-2">
              {categories.map((category) => (
                <div key={category.category}>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>{category.category}</span>
                    <span>{formatHours(category.minutes)}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-gray-100">
                    <div
                      className="h-2 rounded-full bg-[#315f72]"
                      style={{ width: `${(category.minutes / maxCategoryMinutes) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900">Compared to peers</h3>
            {!comparison.peers.length ? (
              <p className="mt-2 text-sm text-gray-500">No peers to compare (unique {comparison.mode}).</p>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-md bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Repetitive share vs peer avg ({comparison.mode})</p>
                  <p className="mt-1 text-sm font-semibold">
                    {stats.repetitiveSharePercent.toFixed(1)}% vs peer avg {peerAverageShare.toFixed(1)}%
                  </p>
                </div>
                <div className="rounded-md bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Total hours vs peer avg ({comparison.mode})</p>
                  <p className="mt-1 text-sm font-semibold">
                    {(stats.totalMinutes / 60).toFixed(1)}h vs peer avg {peerAverageHours.toFixed(1)}h
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}