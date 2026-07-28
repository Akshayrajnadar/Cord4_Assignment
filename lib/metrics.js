// This is a planning assumption, not a value derived from the dataset: only 60%
// of repetitive-task time is treated as realistically automatable.
export const AUTOMATION_RECOVERY_RATE = 0.6;

// 52 weeks / 12 months = 4.33 average weeks per month, used to normalize
// whatever date window the uploaded data actually covers into a monthly figure.
export const WEEKS_PER_MONTH = 4.33;

// 21.67 working days/month * 8 hours/day * 60 minutes/hour ~= 10,400 minutes.
// This converts monthly compensation into a per-minute labor-cost estimate.
export const MINUTES_PER_WORKING_MONTH = Math.round(21.67 * 8 * 60);

const MINUTES_PER_HOUR = 60;
const AUDIT_ROW_LIMIT = 500;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const WEEK_IN_MS = 7 * DAY_IN_MS;

function roundTo(value, digits) {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function parseRowDate(row) {
  const raw = row.timestamp_iso || row.timestamp || row.date;
  if (!raw) return null;

  const date = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateRange(joinedRows) {
  const dates = joinedRows.map(parseRowDate).filter(Boolean);
  if (!dates.length) {
    return { start: null, end: null, weeksCovered: 0 };
  }

  const minTime = Math.min(...dates.map((date) => date.getTime()));
  const maxTime = Math.max(...dates.map((date) => date.getTime()));
  const coveredMs = maxTime - minTime + DAY_IN_MS;

  return {
    start: new Date(minTime).toISOString(),
    end: new Date(maxTime).toISOString(),
    weeksCovered: Math.max(1, Math.ceil(coveredMs / WEEK_IN_MS)),
  };
}

function auditRow(row) {
  return {
    employee_id: row.employee_id ?? row.employeeId ?? null,
    department: row.department ?? row.employee?.department ?? null,
    task_category: row.task_category ?? row.category ?? null,
    duration_minutes: Number(row.duration_minutes ?? row.durationMinutes ?? 0),
    timestamp: row.timestamp_iso || row.timestamp || row.date || null,
  };
}

function compensationFor(row) {
  const value = row.employee?.monthlyCompensationINR;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function computeHeadlineNumbers(joinedRows = []) {
  const rows = Array.isArray(joinedRows) ? joinedRows : [];
  const { start, end, weeksCovered } = dateRange(rows);
  const unknownRepetitiveRows = rows.filter((row) => row.is_repetitive === null);
  const repetitiveRows = rows.filter((row) => row.is_repetitive === true);
  const monthlyNormalizer = weeksCovered ? WEEKS_PER_MONTH / weeksCovered : 0;

  let totalRecoverableMinutesRaw = 0;
  let totalRecoverableRupeesRaw = 0;
  let rowsExcludedNoCompensation = 0;
  const hoursContributingRows = [];
  const rupeesContributingRows = [];

  for (const row of repetitiveRows) {
    const durationMinutes = Number(row.duration_minutes ?? row.durationMinutes ?? 0);
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) continue;

    const recoverableMinutes = durationMinutes * AUTOMATION_RECOVERY_RATE;
    totalRecoverableMinutesRaw += recoverableMinutes;

    if (hoursContributingRows.length < AUDIT_ROW_LIMIT) {
      hoursContributingRows.push(auditRow(row));
    }

    const monthlyCompensationINR = compensationFor(row);
    if (monthlyCompensationINR === null) {
      rowsExcludedNoCompensation += 1;
      continue;
    }

    // Rupees use a stricter denominator than hours: rows without employee
    // compensation remain valid for recoverable-hours math but are excluded
    // from labor-value math so we do not invent salary data.
    const perMinuteRate = monthlyCompensationINR / MINUTES_PER_WORKING_MONTH;
    totalRecoverableRupeesRaw += recoverableMinutes * perMinuteRate;

    if (rupeesContributingRows.length < AUDIT_ROW_LIMIT) {
      rupeesContributingRows.push(auditRow(row));
    }
  }

  return {
    recoverableHoursPerMonth: roundTo(
      (totalRecoverableMinutesRaw / MINUTES_PER_HOUR) * monthlyNormalizer,
      1,
    ),
    recoverableINRPerMonth: Math.round(totalRecoverableRupeesRaw * monthlyNormalizer),
    methodology: {
      dateRangeCovered: { start, end },
      weeksCovered,
      totalRepetitiveRows: repetitiveRows.length,
      rowsExcludedUnknownRepetitive: unknownRepetitiveRows.length,
      rowsExcludedNoCompensation,
      automationRecoveryRate: AUTOMATION_RECOVERY_RATE,
      minutesPerWorkingMonth: MINUTES_PER_WORKING_MONTH,
      totalRecoverableMinutesRaw: roundTo(totalRecoverableMinutesRaw, 2),
      totalRecoverableRupeesRaw: roundTo(totalRecoverableRupeesRaw, 2),
    },
    auditTrail: {
      hoursContributingRows,
      hoursContributingRowsTotalCount: repetitiveRows.length,
      rupeesContributingRows,
      rupeesContributingRowsTotalCount: repetitiveRows.length - rowsExcludedNoCompensation,
    },
  };
}