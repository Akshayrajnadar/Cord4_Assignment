const HOURS_PER_WORK_MONTH = 160;
const LPA_TO_ANNUAL_INR = 100000;

function compactString(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeEmployeeId(value) {
  return compactString(value).toUpperCase();
}

function nullableString(value) {
  const normalized = compactString(value);
  return normalized || null;
}

function normalizeDepartment(record) {
  return nullableString(record.department ?? record.Dept) || "Unknown";
}

function normalizeRole(record) {
  return nullableString(record.role ?? record.Role) || nullableString(record.meta?.role ?? record.meta?.Role);
}

function normalizeTenure(record) {
  const value =
    record.tenure ??
    record.tenure_months ??
    record.tenureMonths ??
    record.meta?.tenure ??
    record.meta?.tenure_months ??
    record.meta?.tenureMonths;

  if (value === null || value === undefined || String(value).trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function explicitUnitFrom(record, fieldName = "") {
  const directUnit = compactString(
    record.unit ??
      record.compensation_unit ??
      record.compensationUnit ??
      record.pay_type ??
      record.payType ??
      record.meta?.unit ??
      record.meta?.compensation_unit ??
      record.meta?.pay_type ??
      record.meta?.compensation?.unit,
  ).toLowerCase();

  const combined = `${directUnit} ${fieldName}`.toLowerCase();
  if (/lpa|lakhs?|salary_lpa/.test(combined)) return "lpa";
  if (/hour|hourly/.test(combined)) return "hourly";
  if (/annual|year|yearly|ctc|salary|inr/.test(combined)) return "annual";
  return null;
}

function compensationCandidates(record) {
  const candidates = [];

  for (const [fieldName, value] of Object.entries(record)) {
    if (/compensation|salary|ctc|rate|lpa|pay/i.test(fieldName) && typeof value !== "object") {
      candidates.push({ fieldName, value });
    }
  }

  const meta = record.meta || {};
  for (const [fieldName, value] of Object.entries(meta)) {
    if (/compensation|salary|ctc|rate|lpa|pay/i.test(fieldName) && typeof value !== "object") {
      candidates.push({ fieldName: `meta.${fieldName}`, value });
    }
  }

  const metaCompensation = meta.compensation;
  if (metaCompensation && typeof metaCompensation === "object") {
    for (const [fieldName, value] of Object.entries(metaCompensation)) {
      if (["annual", "hourly", "lpa", "amount", "value"].includes(fieldName.toLowerCase())) {
        candidates.push({ fieldName: `meta.compensation.${fieldName}`, value });
      }
    }
  }

  return candidates;
}

function unitForCandidate(record, candidate, numericValue) {
  const explicitUnit = explicitUnitFrom(record, candidate.fieldName);
  if (explicitUnit) {
    return {
      unit: explicitUnit,
      reasoning: `Explicit unit or field label indicated ${explicitUnit}.`,
    };
  }

  if (numericValue < 100 && /lpa/i.test(candidate.fieldName)) {
    return {
      unit: "lpa",
      reasoning: "Small value in an LPA-labeled field was treated as lakhs per annum.",
    };
  }

  if (numericValue < 5000) {
    return {
      unit: "hourly",
      reasoning: "No explicit unit; value under 5000 was assumed to be hourly INR.",
    };
  }

  return {
    unit: "annual",
    reasoning: "No explicit unit; value at least 5000 was assumed to be annual INR.",
  };
}

function normalizeCompensation(record) {
  const candidates = compensationCandidates(record);

  for (const candidate of candidates) {
    if (candidate.value === null || candidate.value === undefined || String(candidate.value).trim() === "") {
      continue;
    }

    const originalValue = candidate.value;
    const numericValue = Number(candidate.value);
    if (!Number.isFinite(numericValue)) continue;

    const { unit, reasoning } = unitForCandidate(record, candidate, numericValue);
    let monthlyCompensationINR;

    if (unit === "hourly") {
      monthlyCompensationINR = numericValue * HOURS_PER_WORK_MONTH;
    } else if (unit === "lpa") {
      monthlyCompensationINR = (numericValue * LPA_TO_ANNUAL_INR) / 12;
    } else {
      monthlyCompensationINR = numericValue / 12;
    }

    return {
      monthlyCompensationINR: Number(monthlyCompensationINR.toFixed(2)),
      compensationSource: {
        originalValue,
        assumedUnit: unit,
        reasoning,
      },
    };
  }

  return {
    monthlyCompensationINR: null,
    compensationSource: {
      originalValue: null,
      assumedUnit: null,
      reasoning: "No compensation value was present in a recognized field.",
    },
  };
}

function toHourMinute(value) {
  const raw = compactString(value);
  if (!raw) return null;

  const match = raw.match(/^(\d{1,2})(?::(\d{1,2}))?$/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function normalizeWorkingHours(value) {
  if (!value) return null;

  if (typeof value === "string") {
    const [start, end] = value.split("-").map(toHourMinute);
    return start && end ? { start, end } : null;
  }

  if (typeof value === "object") {
    const start = toHourMinute(value.start);
    const end = toHourMinute(value.end);
    return start && end ? { start, end } : null;
  }

  return null;
}

function normalizeTerminatedOn(value) {
  const raw = compactString(value);
  if (!raw) return null;

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function normalizeStatus(record) {
  const terminatedOn = normalizeTerminatedOn(record.terminated_on ?? record.terminatedOn);
  const rawStatus = compactString(record.status ?? record.Status).toLowerCase();
  const employmentStatus = terminatedOn || rawStatus === "terminated" ? "terminated" : "active";

  return { employmentStatus, terminatedOn };
}

function extractRawEmployees(hrmsData) {
  if (Array.isArray(hrmsData)) return hrmsData;
  if (Array.isArray(hrmsData?.data?.employees)) return hrmsData.data.employees;
  if (Array.isArray(hrmsData?.employees)) return hrmsData.employees;
  return [];
}

function canonicalizeEmployee(record, index) {
  const employeeId = normalizeEmployeeId(record.employee_id ?? record.EmployeeID);
  const department = normalizeDepartment(record);
  const role = normalizeRole(record);
  const tenure = normalizeTenure(record);
  const compensation = normalizeCompensation(record);
  const workingHours = normalizeWorkingHours(record.working_hours ?? record.workingHours);
  const status = normalizeStatus(record);

  return {
    employee: {
      employeeId,
      department,
      role,
      tenure,
      monthlyCompensationINR: compensation.monthlyCompensationINR,
      compensationSource: compensation.compensationSource,
      workingHours,
      employmentStatus: status.employmentStatus,
      terminatedOn: status.terminatedOn,
    },
    rawRecord: record,
    index,
    missingScore:
      (department === "Unknown" ? 1 : 0) +
      (role === null ? 1 : 0) +
      (tenure === null ? 1 : 0) +
      (compensation.monthlyCompensationINR === null ? 1 : 0) +
      (workingHours === null ? 1 : 0),
  };
}

function resolveDuplicate(candidates) {
  const sorted = [...candidates].sort((a, b) => {
    if (a.missingScore !== b.missingScore) return a.missingScore - b.missingScore;
    return b.index - a.index;
  });

  const kept = sorted[0];
  const tied = candidates.filter((candidate) => candidate.missingScore === kept.missingScore).length > 1;
  const resolution = tied
    ? `Kept record at index ${kept.index} because missing-field scores tied and later records are treated as newer.`
    : `Kept record at index ${kept.index} because it had fewer null or missing fields.`;

  return { kept, resolution };
}

function pushMissingReports(employee, report) {
  if (employee.department === "Unknown") report.missingDepartment.push(employee.employeeId);
  if (employee.role === null || employee.tenure === null) report.missingRoleOrTenure.push(employee.employeeId);
  if (employee.monthlyCompensationINR === null) report.missingCompensation.push(employee.employeeId);
  if (employee.workingHours === null) report.missingWorkingHours.push(employee.employeeId);
}

export function reconcileHRMS(hrmsData, activityEmployeeIds = []) {
  const rawEmployees = extractRawEmployees(hrmsData);
  const byEmployeeId = new Map();

  rawEmployees.forEach((record, index) => {
    const canonical = canonicalizeEmployee(record || {}, index);
    if (!canonical.employee.employeeId) return;

    const existing = byEmployeeId.get(canonical.employee.employeeId) || [];
    existing.push(canonical);
    byEmployeeId.set(canonical.employee.employeeId, existing);
  });

  const report = {
    totalRecordsIn: rawEmployees.length,
    missingDepartment: [],
    missingRoleOrTenure: [],
    missingCompensation: [],
    missingWorkingHours: [],
    duplicateEmployeeIds: [],
    compensationConversions: [],
  };

  const activityIdSet = new Set(activityEmployeeIds.map(normalizeEmployeeId));
  const employees = [];

  for (const [employeeId, candidates] of byEmployeeId.entries()) {
    const { kept, resolution } = candidates.length > 1 ? resolveDuplicate(candidates) : { kept: candidates[0], resolution: "Only one record present." };

    if (candidates.length > 1) {
      report.duplicateEmployeeIds.push({
        employeeId,
        records: candidates.map((candidate) => candidate.rawRecord),
        resolution,
      });
    }

    employees.push(kept.employee);
    pushMissingReports(kept.employee, report);

    report.compensationConversions.push({
      employeeId,
      activitySeen: activityIdSet.size ? activityIdSet.has(employeeId) : null,
      ...kept.employee.compensationSource,
    });
  }

  employees.sort((a, b) => a.employeeId.localeCompare(b.employeeId));
  return { employees, report };
}

export function joinData(cleanRows, employees) {
  const employeeById = new Map(employees.map((employee) => [normalizeEmployeeId(employee.employeeId), employee]));
  const activityIds = new Set();
  const employeeIdsWithNoMetadata = new Set();
  let rowsWithMetadata = 0;

  const joinedRows = cleanRows.map((row) => {
    const employeeId = normalizeEmployeeId(row.employee_id ?? row.employeeId);
    const employee = employeeById.get(employeeId) || null;

    activityIds.add(employeeId);
    if (employee) rowsWithMetadata += 1;
    else employeeIdsWithNoMetadata.add(employeeId);

    return {
      ...row,
      employee,
    };
  });

  const employeesWithNoActivity = employees
    .map((employee) => normalizeEmployeeId(employee.employeeId))
    .filter((employeeId) => !activityIds.has(employeeId))
    .sort();

  return {
    joinedRows,
    employeesWithNoActivity,
    employeeIdsWithNoMetadata: [...employeeIdsWithNoMetadata].sort(),
    summary: {
      totalActivityRows: cleanRows.length,
      rowsWithMetadata,
      rowsWithoutMetadata: cleanRows.length - rowsWithMetadata,
      totalEmployeesInHRMS: employees.length,
      employeesWithNoActivityCount: employeesWithNoActivity.length,
    },
  };
}

// Compatibility helpers for the dashboard scaffold that predated the final join contract.
export function joinActivityWithEmployees(activityLogs, employees) {
  const { joinedRows } = joinData(
    activityLogs.map((log) => ({
      ...log,
      employee_id: log.employee_id ?? log.employeeId,
    })),
    employees,
  );

  return joinedRows.map((row) => ({
    ...row,
    employeeName: row.employee?.employeeName || row.employee?.employeeId || "Unknown Employee",
    department: row.employee?.department || row.department || "Unassigned",
    role: row.employee?.role || "Unassigned",
    manager: row.employee?.manager || "Unassigned",
    hrmsMatched: Boolean(row.employee),
  }));
}

export function summarizeDataset(joinedRows, employees) {
  const getMinutes = (row) => row.durationMinutes ?? row.duration_minutes ?? 0;
  const getCategory = (row) => row.category ?? row.task_category ?? "Uncategorized";
  const getEmployeeId = (row) => row.employeeId ?? row.employee_id;
  const getDate = (row) => row.date ?? row.timestamp_iso?.slice(0, 10) ?? "Unknown";
  const totalMinutes = joinedRows.reduce((sum, row) => sum + getMinutes(row), 0);
  const categoryMap = new Map();
  const employeeMap = new Map();
  const dateMap = new Map();

  for (const row of joinedRows) {
    const minutes = getMinutes(row);
    const category = getCategory(row);
    const employeeId = getEmployeeId(row);
    const date = getDate(row);

    categoryMap.set(category, (categoryMap.get(category) || 0) + minutes);
    dateMap.set(date, (dateMap.get(date) || 0) + minutes);

    const current = employeeMap.get(employeeId) || {
      employeeId,
      employeeName: row.employeeName || row.employee?.employeeId || employeeId,
      department: row.department || row.employee?.department || "Unassigned",
      role: row.role || row.employee?.role || "Unassigned",
      totalMinutes: 0,
      productiveMinutes: 0,
      sessions: 0,
    };

    current.totalMinutes += minutes;
    current.productiveMinutes += row.productive ? minutes : 0;
    current.sessions += 1;
    employeeMap.set(employeeId, current);
  }

  const categoryBreakdown = [...categoryMap.entries()]
    .map(([category, minutes]) => ({
      category,
      minutes,
      share: totalMinutes ? Number(((minutes / totalMinutes) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.minutes - a.minutes);

  const employeeRankings = [...employeeMap.values()]
    .map((employee) => ({
      ...employee,
      productiveShare: employee.totalMinutes
        ? Number(((employee.productiveMinutes / employee.totalMinutes) * 100).toFixed(1))
        : 0,
    }))
    .sort((a, b) => b.totalMinutes - a.totalMinutes);

  return {
    rows: joinedRows,
    employees: employees.map((employee) => ({
      ...employee,
      logs: joinedRows.filter((row) => getEmployeeId(row) === employee.employeeId),
    })),
    metrics: {
      totalEmployees: employees.length,
      totalSessions: joinedRows.length,
      totalMinutes,
      totalHours: Number((totalMinutes / 60).toFixed(1)),
      hrmsMatchRate: joinedRows.length
        ? Number(((joinedRows.filter((row) => row.hrmsMatched).length / joinedRows.length) * 100).toFixed(1))
        : 0,
    },
    categoryBreakdown,
    employeeRankings,
    trends: [...dateMap.entries()]
      .map(([date, minutes]) => ({ date, minutes }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    anomalies: joinedRows
      .filter((row) => getMinutes(row) >= 180 || (!row.productive && getMinutes(row) >= 90))
      .map((row) => ({
        employeeId: getEmployeeId(row),
        employeeName: row.employeeName || row.employee?.employeeId || getEmployeeId(row),
        date: getDate(row),
        app: row.app || row.app_used,
        reason: getMinutes(row) >= 180 ? "an unusually long session" : "extended unproductive usage",
        durationMinutes: getMinutes(row),
      })),
  };
}