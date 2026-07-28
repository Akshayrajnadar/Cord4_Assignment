import fs from "node:fs";
import path from "node:path";
import { cleanActivityLogs } from "@/lib/clean";
import { joinData, reconcileHRMS, summarizeDataset } from "@/lib/join";
import { computeHeadlineNumbers } from "@/lib/metrics";
import { computeWeeklyRepetitiveShare } from "@/lib/trends";
import { detectAnomalies } from "@/lib/anomalies";

let cachedDataset;

function parseCsv(text) {
  const [headerLine, ...lines] = text.trim().split(/\r?\n/);
  const headers = headerLine.split(",").map((header) => header.trim());

  return lines.filter(Boolean).map((line) => {
    const values = line.split(",").map((value) => value.trim());
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
  });
}

function rawEmployeesFrom(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data?.employees)) return payload.data.employees;
  if (Array.isArray(payload?.employees)) return payload.employees;
  return [];
}

function serializeActivityRows(rows) {
  return rows.map((row) => ({
    ...row,
    timestamp: row.timestamp instanceof Date ? row.timestamp.toISOString() : row.timestamp,
  }));
}

export function getDataset() {
  if (cachedDataset) return cachedDataset;

  const dataDir = path.join(process.cwd(), "data");
  const activityCsv = fs.readFileSync(path.join(dataDir, "activity_logs.csv"), "utf8");
  const employeesJson = fs.readFileSync(path.join(dataDir, "employees.json"), "utf8");
  const hrmsData = JSON.parse(employeesJson);
  const rawActivityRows = parseCsv(activityCsv);
  const knownEmployeeIds = rawEmployeesFrom(hrmsData)
    .map((employee) => employee.employee_id || employee.EmployeeID)
    .filter(Boolean);

  const cleanResult = cleanActivityLogs(rawActivityRows, knownEmployeeIds);
  const cleanRows = serializeActivityRows(cleanResult.cleanRows);
  const hrmsResult = reconcileHRMS(hrmsData, cleanRows.map((row) => row.employee_id));
  const joinResult = joinData(cleanRows, hrmsResult.employees);
  const joinedRows = joinResult.joinedRows;
  const trendResult = computeWeeklyRepetitiveShare(joinedRows);

  cachedDataset = {
    ...summarizeDataset(joinedRows, hrmsResult.employees),
    rows: joinedRows,
    employees: hrmsResult.employees.map((employee) => ({
      ...employee,
      logs: joinedRows.filter((row) => row.employee_id === employee.employeeId),
    })),
    cleanReport: cleanResult.report,
    hrmsReport: hrmsResult.report,
    joinSummary: {
      ...joinResult.summary,
      employeesWithNoActivity: joinResult.employeesWithNoActivity,
      employeeIdsWithNoMetadata: joinResult.employeeIdsWithNoMetadata,
    },
    headlineMetrics: computeHeadlineNumbers(joinedRows),
    weeklyTrends: trendResult.trends,
    trendDirection: trendResult.trendDirection,
    anomaly: detectAnomalies(joinedRows, hrmsResult.employees),
  };
  return cachedDataset;
}