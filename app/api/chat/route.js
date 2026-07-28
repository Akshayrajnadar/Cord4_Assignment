import { detectAnomalies } from "@/lib/anomalies";
import { getDataset } from "@/lib/dataset";
import { computeHeadlineNumbers } from "@/lib/metrics";
import { computeAutomationRanking } from "@/lib/ranking";
import { computeWeeklyRepetitiveShare } from "@/lib/trends";

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash"; // Configurable in .env; fallback stays on a current GA Flash model.
const GEMINI_ENDPOINT =
  process.env.GEMINI_ENDPOINT ||
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const TOP_EMPLOYEE_TASKS = 3;

function employeeIdFor(row) {
  return String(row.employee_id ?? row.employeeId ?? "Unknown").trim().toUpperCase();
}

function departmentFor(row) {
  return row.department || row.employee?.department || "Unknown";
}

function taskCategoryFor(row) {
  return row.task_category || row.category || "Uncategorized";
}

function durationFor(row) {
  const minutes = Number(row.duration_minutes ?? row.durationMinutes ?? 0);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
}

function timestampFor(row) {
  return row.timestamp_iso || row.timestamp || row.date || null;
}

function parseDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function roundTo(value, digits) {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function topCategories(rows, limit = TOP_EMPLOYEE_TASKS) {
  const buckets = new Map();
  for (const row of rows) {
    const category = taskCategoryFor(row);
    buckets.set(category, (buckets.get(category) || 0) + durationFor(row));
  }

  return [...buckets.entries()]
    .map(([taskCategory, minutes]) => ({
      taskCategory,
      hours: roundTo(minutes / 60, 1),
    }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, limit);
}

function repetitiveShare(rows) {
  const known = rows.filter((row) => row.is_repetitive === true || row.is_repetitive === false);
  if (!known.length) return null;
  const repetitive = known.filter((row) => row.is_repetitive === true).length;
  return roundTo((repetitive / known.length) * 100, 1);
}

function summarizeEmployees(joinedRows, employees) {
  const employeeMap = new Map((employees || []).map((employee) => [employee.employeeId, employee]));
  const ids = new Set([...employeeMap.keys(), ...joinedRows.map(employeeIdFor)]);

  return [...ids]
    .sort()
    .map((employeeId) => {
      const rows = joinedRows.filter((row) => employeeIdFor(row) === employeeId);
      const employee = employeeMap.get(employeeId) || rows[0]?.employee || null;
      const totalMinutes = rows.reduce((sum, row) => sum + durationFor(row), 0);
      const repetitiveMinutes = rows.reduce(
        (sum, row) => sum + (row.is_repetitive === true ? durationFor(row) : 0),
        0,
      );

      return {
        employeeId,
        employeeName: employee?.employeeName || employee?.name || null,
        department: employee?.department || rows[0]?.department || "Unknown",
        role: employee?.role || null,
        totalHours: roundTo(totalMinutes / 60, 1),
        repetitiveHours: roundTo(repetitiveMinutes / 60, 1),
        repetitiveSharePercent: repetitiveShare(rows),
        topTaskCategories: topCategories(rows),
        rowCount: rows.length,
        hasMetadata: Boolean(employee),
      };
    });
}

function summarizeDepartments(joinedRows, employees) {
  const employeeDepartments = new Map((employees || []).map((employee) => [employee.employeeId, employee.department || "Unknown"]));
  const buckets = new Map();

  for (const row of joinedRows) {
    const employeeId = employeeIdFor(row);
    const department = departmentFor(row);
    const bucket = buckets.get(department) || {
      department,
      minutes: 0,
      rows: [],
      employeeIds: new Set(),
    };

    bucket.minutes += durationFor(row);
    bucket.rows.push(row);
    bucket.employeeIds.add(employeeId);
    buckets.set(department, bucket);
  }

  for (const [employeeId, department] of employeeDepartments.entries()) {
    const bucket = buckets.get(department) || {
      department,
      minutes: 0,
      rows: [],
      employeeIds: new Set(),
    };
    bucket.employeeIds.add(employeeId);
    buckets.set(department, bucket);
  }

  return [...buckets.values()]
    .map((bucket) => ({
      department: bucket.department,
      totalHours: roundTo(bucket.minutes / 60, 1),
      repetitiveSharePercent: repetitiveShare(bucket.rows),
      headcount: bucket.employeeIds.size,
      rowCount: bucket.rows.length,
    }))
    .sort((a, b) => b.totalHours - a.totalHours);
}

function dateRange(joinedRows) {
  const dates = joinedRows.map((row) => parseDate(timestampFor(row))).filter(Boolean);
  if (!dates.length) return { start: null, end: null };

  return {
    start: new Date(Math.min(...dates.map((date) => date.getTime()))).toISOString(),
    end: new Date(Math.max(...dates.map((date) => date.getTime()))).toISOString(),
  };
}

function buildSystemContext() {
  const dataset = getDataset();
  const joinedRows = dataset.rows || [];
  const employees = dataset.employees || [];
  const headlineNumbers = computeHeadlineNumbers(joinedRows);
  const automationRanking = computeAutomationRanking(joinedRows);
  const weeklyTrend = computeWeeklyRepetitiveShare(joinedRows);
  const anomaly = detectAnomalies(joinedRows, employees);

  const contextPayload = {
    dateRangeCovered: dateRange(joinedRows),
    sourceCounts: {
      joinedActivityRows: joinedRows.length,
      employees: employees.length,
      taskCategories: automationRanking.length,
    },
    headlineNumbers,
    automationRanking,
    employeeSummaries: summarizeEmployees(joinedRows, employees),
    departmentRollups: summarizeDepartments(joinedRows, employees),
    weeklyTrend,
    anomaly,
    dataQuality: {
      metrics: dataset.metrics || null,
      employeeIdsWithNoMetadata: joinedRows
        .filter((row) => !row.employee)
        .map(employeeIdFor)
        .filter((value, index, values) => values.indexOf(value) === index)
        .sort(),
    },
  };

  // Context is intentionally summarized: roughly 15-20 employee rows, department
  // rollups, weekly trends, and ranking rows instead of the raw 540 activity rows.
  // If this grows past comfortable prompt size, trim employeeSummaries or ranking detail first.
  return `You are a data assistant for a workforce analytics dashboard. You may ONLY use the data provided in this context. Every specific number, employee name, category, or statistic you state MUST be traceable to a value in the provided data - cite it inline, e.g. "(340 rows, Oct 1-28)" or "(Finance dept, 5 employees)". If the data provided doesn't contain enough information to answer precisely, say so explicitly rather than estimating or inventing a number. Do not perform new calculations beyond simple sums/comparisons of the provided figures - if a question requires a computation not present in the data, state what's missing.

STRUCTURED DASHBOARD DATA:
${JSON.stringify(contextPayload, null, 2)}`;
}

function toGeminiContents(messages) {
  return messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: String(message.content || "") }],
  }));
}

function extractReply(data) {
  return data?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim() || "";
}

export async function POST(request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const sanitizedMessages = messages
    .filter((message) => ["user", "assistant"].includes(message?.role) && typeof message.content === "string")
    .slice(-12);

  if (!sanitizedMessages.length || sanitizedMessages[sanitizedMessages.length - 1].role !== "user") {
    return Response.json({ error: "Send a messages array ending with a user message." }, { status: 400 });
  }

  try {
    const response = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: buildSystemContext() }],
        },
        contents: toGeminiContents(sanitizedMessages),
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 900,
        },
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return Response.json(
        { error: data.error?.message || `Gemini API request failed with status ${response.status}` },
        { status: 500 },
      );
    }

    const reply = extractReply(data);
    if (!reply) {
      return Response.json({ error: "Gemini API returned an empty response" }, { status: 500 });
    }

    return Response.json({ reply });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Gemini API request failed" },
      { status: 500 },
    );
  }
}