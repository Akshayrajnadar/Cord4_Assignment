const STANDARD_Z_THRESHOLD = 2;
const RELAXED_Z_THRESHOLD = 1.5;

function parseDate(row) {
  const raw = row.timestamp_iso || row.timestamp || row.date;
  if (!raw) return null;
  const date = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfIsoWeek(date) {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() - day + 1);
  copy.setUTCHours(0, 0, 0, 0);
  return copy.toISOString();
}

function employeeIdFor(row) {
  return String(row.employee_id ?? row.employeeId ?? "Unknown").trim().toUpperCase();
}

function departmentFor(row, employeeMap) {
  const employeeId = employeeIdFor(row);
  return row.department || row.employee?.department || employeeMap.get(employeeId)?.department || "Unknown";
}

function repetitiveMinutes(row) {
  if (row.is_repetitive !== true) return 0;
  const minutes = Number(row.duration_minutes ?? row.durationMinutes ?? 0);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function stdDev(values, avg) {
  if (values.length < 2) return 0;
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function buildStats(groups, entityType) {
  return [...groups.values()]
    .map((group) => ({
      type: entityType,
      id: group.id,
      department: group.department,
      weekCount: group.weeks.size,
      value: group.weeks.size ? group.repetitiveMinutes / 60 / group.weeks.size : 0,
    }))
    .filter((item) => item.weekCount >= 2);
}

function findOutlier(stats, threshold, relaxed) {
  if (stats.length < 2) return null;

  const values = stats.map((item) => item.value);
  const groupMean = mean(values);
  const groupStdDev = stdDev(values, groupMean);
  if (groupStdDev === 0) return null;

  const flagged = stats
    .map((item) => ({
      ...item,
      zScore: (item.value - groupMean) / groupStdDev,
      groupMean,
      groupStdDev,
    }))
    .filter((item) => Math.abs(item.zScore) > threshold)
    .sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));

  if (!flagged.length) return null;
  return toAnomaly(flagged[0], threshold, relaxed);
}

function toAnomaly(item, threshold, relaxed) {
  const direction = item.zScore > 0 ? "above" : "below";
  const label = item.type === "employee" ? item.id : item.department;
  const subject = item.type === "employee" ? item.id : `${item.department} department`;
  const relaxedNote = relaxed ? " A relaxed 1.5 standard-deviation threshold was used because no employee or department crossed the standard 2 standard-deviation bar." : "";

  return {
    type: item.type,
    employeeId: item.type === "employee" ? item.id : null,
    department: item.department,
    metric: "weekly repetitive hours",
    value: Number(item.value.toFixed(1)),
    groupMean: Number(item.groupMean.toFixed(1)),
    groupStdDev: Number(item.groupStdDev.toFixed(1)),
    zScore: Number(item.zScore.toFixed(2)),
    direction,
    explanation: `${subject} logs ${item.value.toFixed(1)} repetitive hours/week on average, vs a company average of ${item.groupMean.toFixed(1)} (+/- ${item.groupStdDev.toFixed(1)}) - more than ${threshold} standard deviations ${direction} normal. Worth checking whether this is a role misfit, undocumented process, or data entry issue.${relaxedNote}`,
    label,
  };
}

function groupEmployees(joinedRows, employeeMap) {
  const groups = new Map();

  for (const row of joinedRows) {
    const date = parseDate(row);
    if (!date) continue;

    const employeeId = employeeIdFor(row);
    const group = groups.get(employeeId) || {
      id: employeeId,
      department: departmentFor(row, employeeMap),
      weeks: new Set(),
      repetitiveMinutes: 0,
    };

    group.weeks.add(startOfIsoWeek(date));
    group.repetitiveMinutes += repetitiveMinutes(row);
    groups.set(employeeId, group);
  }

  return groups;
}

function groupDepartments(joinedRows, employeeMap) {
  const groups = new Map();

  for (const row of joinedRows) {
    const date = parseDate(row);
    if (!date) continue;

    const department = departmentFor(row, employeeMap);
    const group = groups.get(department) || {
      id: department,
      department,
      weeks: new Set(),
      repetitiveMinutes: 0,
    };

    group.weeks.add(startOfIsoWeek(date));
    group.repetitiveMinutes += repetitiveMinutes(row);
    groups.set(department, group);
  }

  return groups;
}

export function detectAnomalies(joinedRows = [], employees = []) {
  const rows = Array.isArray(joinedRows) ? joinedRows : [];
  const employeeMap = new Map((Array.isArray(employees) ? employees : []).map((employee) => [employee.employeeId, employee]));
  if (!rows.length) return null;

  // Employees with fewer than two weeks of data are excluded from the z-score
  // comparison because one-week averages are too brittle to call anomalous.
  const employeeStats = buildStats(groupEmployees(rows, employeeMap), "employee");
  const standardEmployee = findOutlier(employeeStats, STANDARD_Z_THRESHOLD, false);
  if (standardEmployee) return standardEmployee;

  const departmentStats = buildStats(groupDepartments(rows, employeeMap), "department");
  const standardDepartment = findOutlier(departmentStats, STANDARD_Z_THRESHOLD, false);
  if (standardDepartment) return standardDepartment;

  // Two standard deviations is a common threshold for a notably unusual value;
  // if nobody crosses it, we relax to 1.5 so the dashboard can still surface the
  // most investigation-worthy pattern without pretending it crossed the stricter bar.
  return (
    findOutlier(employeeStats, RELAXED_Z_THRESHOLD, true) ||
    findOutlier(departmentStats, RELAXED_Z_THRESHOLD, true)
  );
}