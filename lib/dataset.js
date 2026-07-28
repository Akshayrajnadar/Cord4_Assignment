import fs from "node:fs";
import path from "node:path";
import { cleanActivityLog, cleanEmployee } from "@/lib/clean";
import { joinActivityWithEmployees, summarizeDataset } from "@/lib/join";
import { computeHeadlineNumbers } from "@/lib/metrics";

let cachedDataset;

function parseCsv(text) {
  const [headerLine, ...lines] = text.trim().split(/\r?\n/);
  const headers = headerLine.split(",").map((header) => header.trim());

  return lines.filter(Boolean).map((line) => {
    const values = line.split(",").map((value) => value.trim());
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
  });
}

function normalizeEmployeePayload(payload) {
  const records = Array.isArray(payload) ? payload : payload.employees || [];
  const employeesById = new Map();

  for (const record of records.map(cleanEmployee)) {
    if (!record.employeeId) continue;
    employeesById.set(record.employeeId, {
      ...employeesById.get(record.employeeId),
      ...record,
    });
  }

  return [...employeesById.values()];
}

export function getDataset() {
  if (cachedDataset) return cachedDataset;

  const dataDir = path.join(process.cwd(), "data");
  const activityCsv = fs.readFileSync(path.join(dataDir, "activity_logs.csv"), "utf8");
  const employeesJson = fs.readFileSync(path.join(dataDir, "employees.json"), "utf8");

  const activityLogs = parseCsv(activityCsv).map(cleanActivityLog);
  const employees = normalizeEmployeePayload(JSON.parse(employeesJson));
  const joinedRows = joinActivityWithEmployees(activityLogs, employees);

  cachedDataset = {
    ...summarizeDataset(joinedRows, employees),
    headlineMetrics: computeHeadlineNumbers(joinedRows),
  };
  return cachedDataset;
}
