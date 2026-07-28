export const MAX_DURATION_MINUTES = 480;

const IST_OFFSET_MINUTES = 330;

const DEPARTMENT_CANONICALS = new Map([
  ["operations", "Operations"],
  ["finance", "Finance"],
  ["sales", "Sales"],
  ["cs", "CS"],
  ["hr", "HR"],
  ["marketing", "Marketing"],
]);

const TASK_CATEGORY_SYNONYMS = new Map([
  ["crm update", "CRM Updates"],
  ["crm updates", "CRM Updates"],
  ["crm updt", "CRM Updates"],
  ["cal mgmt", "Calendar Management"],
  ["calendar mgmt", "Calendar Management"],
  ["calendar management", "Calendar Management"],
  ["internal comms", "Internal Communication"],
  ["internal communication", "Internal Communication"],
  ["lead-entry", "Lead Entry"],
  ["lead entry", "Lead Entry"],
  ["status update", "Status Updates"],
  ["status updates", "Status Updates"],
]);

const TRUE_VALUES = new Set(["true", "1", "yes"]);
const FALSE_VALUES = new Set(["false", "0", "no"]);
const UNKNOWN_BOOL_VALUES = new Set(["", "na", "n/a"]);

function titleCase(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function normalizeCompactString(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeEmployeeId(value) {
  return normalizeCompactString(value).toUpperCase();
}

function normalizeDepartment(value) {
  const trimmed = normalizeCompactString(value);
  const key = trimmed.toLowerCase();
  return DEPARTMENT_CANONICALS.get(key) || titleCase(trimmed);
}

function normalizeMappedTitle(value, canonicalMap) {
  const trimmed = normalizeCompactString(value);
  if (!trimmed) return "Unknown";

  const key = trimmed.toLowerCase();
  if (canonicalMap.has(key)) return canonicalMap.get(key);

  const canonical = titleCase(trimmed);
  canonicalMap.set(key, canonical);
  return canonical;
}

function normalizeTaskCategory(value, canonicalMap) {
  const trimmed = normalizeCompactString(value);
  if (!trimmed) {
    return {
      value: "Uncategorized",
      wasBlank: true,
      wasUnmapped: false,
    };
  }

  const key = trimmed.toLowerCase();
  const mapped = TASK_CATEGORY_SYNONYMS.get(key);
  if (mapped) {
    canonicalMap.set(key, mapped);
    return {
      value: mapped,
      wasBlank: false,
      wasUnmapped: false,
    };
  }

  if (canonicalMap.has(key)) {
    return {
      value: canonicalMap.get(key),
      wasBlank: false,
      wasUnmapped: true,
    };
  }

  const canonical = titleCase(trimmed);
  canonicalMap.set(key, canonical);
  return {
    value: canonical,
    wasBlank: false,
    wasUnmapped: true,
  };
}

function parseDurationMinutes(value) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return { valid: false, dropped: true, fixed: false };
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { valid: false, dropped: true, fixed: false };
  }

  const rounded = Math.round(parsed);

  // 480 minutes is one 8-hour workday; longer single activities are probably entry errors.
  if (rounded > MAX_DURATION_MINUTES) {
    return { valid: true, value: MAX_DURATION_MINUTES, dropped: false, fixed: true };
  }

  return { valid: true, value: rounded, dropped: false, fixed: false };
}

function parseRepetitive(value) {
  if (value === null || value === undefined) {
    return { value: null, unknown: true };
  }

  const key = String(value).trim().toLowerCase();
  if (UNKNOWN_BOOL_VALUES.has(key)) return { value: null, unknown: true };
  if (TRUE_VALUES.has(key)) return { value: true, unknown: false };
  if (FALSE_VALUES.has(key)) return { value: false, unknown: false };

  return { value: null, unknown: true };
}

function isValidDateParts(year, month, day, hour, minute, second) {
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute &&
    date.getUTCSeconds() === second
  );
}

function toIstDate(year, month, day, hour = 0, minute = 0, second = 0) {
  if (!isValidDateParts(year, month, day, hour, minute, second)) return null;

  const utcMillis =
    Date.UTC(year, month - 1, day, hour, minute, second) - IST_OFFSET_MINUTES * 60 * 1000;
  return new Date(utcMillis);
}

function parseTimestamp(value) {
  const raw = normalizeCompactString(value);
  if (!raw) return null;

  const isoMatch = raw.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (isoMatch) {
    return toIstDate(
      Number(isoMatch[1]),
      Number(isoMatch[2]),
      Number(isoMatch[3]),
      Number(isoMatch[4] || 0),
      Number(isoMatch[5] || 0),
      Number(isoMatch[6] || 0),
    );
  }

  const slashMatch = raw.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (!slashMatch) return null;

  const first = Number(slashMatch[1]);
  const second = Number(slashMatch[2]);
  const year = Number(slashMatch[3]);
  const hour = Number(slashMatch[4] || 0);
  const minute = Number(slashMatch[5] || 0);
  const secondOfMinute = Number(slashMatch[6] || 0);

  // In this Indian/IST dataset, ambiguous slash dates are interpreted as DD/MM/YYYY.
  const day = second > 12 ? second : first;
  const month = second > 12 ? first : second;

  return toIstDate(year, month, day, hour, minute, secondOfMinute);
}

function timestampMinuteKey(date) {
  return date.toISOString().slice(0, 16);
}

function buildFlags({
  duplicatesRemoved,
  durationsFixed,
  durationsDropped,
  timestampsUnparseable,
  repetitiveUnknown,
  unknownEmployeeIds,
  unmappedTaskCategories,
  uncategorizedRows,
}) {
  const flags = [];

  if (duplicatesRemoved) {
    flags.push({
      type: "duplicatesRemoved",
      description: "Rows with the same employee, minute, app, and task category were deduplicated.",
      count: duplicatesRemoved,
    });
  }

  if (durationsFixed) {
    flags.push({
      type: "durationsFixed",
      description: `Durations above ${MAX_DURATION_MINUTES} minutes were capped at one workday.`,
      count: durationsFixed,
    });
  }

  if (durationsDropped) {
    flags.push({
      type: "durationsDropped",
      description: "Rows with blank, zero, negative, or nonnumeric durations were dropped.",
      count: durationsDropped,
    });
  }

  if (timestampsUnparseable) {
    flags.push({
      type: "timestampsUnparseable",
      description: "Rows with unparseable timestamps were dropped instead of guessed.",
      count: timestampsUnparseable,
    });
  }

  if (repetitiveUnknown) {
    flags.push({
      type: "repetitiveUnknown",
      description: "Blank or NA repetitive flags were preserved as null rather than treated as false.",
      count: repetitiveUnknown,
    });
  }

  if (unknownEmployeeIds.length) {
    flags.push({
      type: "unknownEmployeeIds",
      description: `Employee IDs not found in the known HRMS set: ${unknownEmployeeIds.join(", ")}.`,
      count: unknownEmployeeIds.length,
    });
  }

  if (unmappedTaskCategories.size) {
    flags.push({
      type: "unmappedTaskCategories",
      description: `Task categories included via title-case fallback: ${[...unmappedTaskCategories].join(", ")}.`,
      count: unmappedTaskCategories.size,
    });
  }

  if (uncategorizedRows) {
    flags.push({
      type: "uncategorizedRows",
      description: "Rows with blank task categories were retained as Uncategorized.",
      count: uncategorizedRows,
    });
  }

  return flags;
}

function normalizeRow(row, canonicalMaps) {
  const timestamp = parseTimestamp(row.timestamp);
  if (!timestamp) return { droppedFor: "timestamp" };

  const duration = parseDurationMinutes(row.duration_minutes);
  if (!duration.valid) return { droppedFor: "duration" };

  const taskCategory = normalizeTaskCategory(row.task_category, canonicalMaps.taskCategories);
  const repetitive = parseRepetitive(row.is_repetitive);

  return {
    row: {
      employee_id: normalizeEmployeeId(row.employee_id),
      department: normalizeDepartment(row.department),
      timestamp,
      timestamp_iso: timestamp.toISOString(),
      app_used: normalizeMappedTitle(row.app_used, canonicalMaps.apps),
      task_category: taskCategory.value,
      duration_minutes: duration.value,
      is_repetitive: repetitive.value,
    },
    meta: {
      durationFixed: duration.fixed,
      repetitiveUnknown: repetitive.unknown,
      taskCategoryWasBlank: taskCategory.wasBlank,
      taskCategoryWasUnmapped: taskCategory.wasUnmapped,
      originalTaskCategory: normalizeCompactString(row.task_category),
    },
  };
}

export function cleanActivityLogs(rawRows, knownEmployeeIds = []) {
  const knownIds = new Set(knownEmployeeIds.map(normalizeEmployeeId));
  const seenDuplicateKeys = new Set();
  const unknownEmployeeIds = new Set();
  const unmappedTaskCategories = new Set();
  const canonicalMaps = {
    apps: new Map(),
    taskCategories: new Map(),
  };
  const cleanRows = [];

  const report = {
    totalRowsIn: Array.isArray(rawRows) ? rawRows.length : 0,
    duplicatesRemoved: 0,
    durationsFixed: 0,
    durationsDropped: 0,
    timestampsUnparseable: 0,
    unknownEmployeeIds: [],
    repetitiveUnknown: 0,
    flags: [],
  };

  for (const rawRow of Array.isArray(rawRows) ? rawRows : []) {
    const normalized = normalizeRow(rawRow || {}, canonicalMaps);

    if (normalized.droppedFor === "timestamp") {
      report.timestampsUnparseable += 1;
      continue;
    }

    if (normalized.droppedFor === "duration") {
      report.durationsDropped += 1;
      continue;
    }

    const { row, meta } = normalized;
    const duplicateKey = [
      row.employee_id,
      timestampMinuteKey(row.timestamp),
      row.app_used.toLowerCase(),
      row.task_category.toLowerCase(),
    ].join("|");

    if (seenDuplicateKeys.has(duplicateKey)) {
      report.duplicatesRemoved += 1;
      continue;
    }

    seenDuplicateKeys.add(duplicateKey);

    if (knownIds.size && !knownIds.has(row.employee_id)) {
      unknownEmployeeIds.add(row.employee_id);
    }

    if (meta.durationFixed) report.durationsFixed += 1;
    if (meta.repetitiveUnknown) report.repetitiveUnknown += 1;
    if (meta.taskCategoryWasUnmapped) unmappedTaskCategories.add(meta.originalTaskCategory);

    cleanRows.push(row);
  }

  report.unknownEmployeeIds = [...unknownEmployeeIds].sort();
  const uncategorizedRows = cleanRows.filter((row) => row.task_category === "Uncategorized").length;
  report.flags = buildFlags({
    duplicatesRemoved: report.duplicatesRemoved,
    durationsFixed: report.durationsFixed,
    durationsDropped: report.durationsDropped,
    timestampsUnparseable: report.timestampsUnparseable,
    repetitiveUnknown: report.repetitiveUnknown,
    unknownEmployeeIds: report.unknownEmployeeIds,
    unmappedTaskCategories,
    uncategorizedRows,
  });

  return { cleanRows, report };
}

// Compatibility helpers for the existing dashboard pipeline.
export function cleanActivityLog(row) {
  const { cleanRows } = cleanActivityLogs([row]);
  const cleanRow = cleanRows[0];

  if (!cleanRow) {
    return {
      employeeId: "",
      date: "Unknown",
      app: "Unknown",
      category: "Uncategorized",
      durationMinutes: 0,
      productive: null,
      isRepetitive: null,
    };
  }

  return {
    employeeId: cleanRow.employee_id,
    date: cleanRow.timestamp_iso.slice(0, 10),
    app: cleanRow.app_used,
    category: cleanRow.task_category,
    durationMinutes: cleanRow.duration_minutes,
    productive: cleanRow.is_repetitive === null ? null : !cleanRow.is_repetitive,
    isRepetitive: cleanRow.is_repetitive,
  };
}

export function cleanEmployee(record) {
  const meta = record.meta || {};

  return {
    employeeId: normalizeEmployeeId(record.employee_id || record.employeeId || record.EmployeeID || record.id),
    employeeName: normalizeCompactString(record.name || record.Name || "Unknown Employee"),
    department: normalizeDepartment(record.department || record.Dept || "Unassigned"),
    role: normalizeCompactString(record.role || record.Role || meta.role || "Unassigned"),
    manager: normalizeCompactString(record.manager || record.Manager || "Unassigned"),
    status: normalizeCompactString(record.status || record.Status || "unknown").toLowerCase(),
    tenureMonths: Number(record.tenure_months || record.tenureMonths || meta.tenure_months || 0),
  };
}