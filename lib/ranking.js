import {
  AUTOMATION_RECOVERY_RATE,
  MINUTES_PER_WORKING_MONTH,
  WEEKS_PER_MONTH,
} from "./metrics.js";

// Volume and rupee impact are weighted highest because they represent direct,
// measurable business value: time removed and labor cost avoided.
export const VOLUME_SCORE_WEIGHT = 0.3;
export const RUPEE_IMPACT_SCORE_WEIGHT = 0.3;

// Repetitiveness is a major feasibility signal, but it is weighted below direct
// value because repetitive work is only worth automating when the payoff is real.
export const REPETITIVENESS_SCORE_WEIGHT = 0.25;

// Concentration is weighted lowest: a task performed by many employees is easier
// to roll out consistently, but rollout ease does not determine business value.
export const CONCENTRATION_SCORE_WEIGHT = 0.15;

const MINUTES_PER_HOUR = 60;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const WEEK_IN_MS = 7 * DAY_IN_MS;

function roundTo(value, digits) {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function employeeIdFor(row) {
  return String(row.employee_id ?? row.employeeId ?? "Unknown").trim().toUpperCase();
}

function taskCategoryFor(row) {
  return String(row.task_category ?? row.category ?? "Uncategorized").trim() || "Uncategorized";
}

function durationFor(row) {
  const parsed = Number(row.duration_minutes ?? row.durationMinutes ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function compensationFor(row) {
  const parsed = Number(row.employee?.monthlyCompensationINR);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseRowDate(row) {
  const raw = row.timestamp_iso || row.timestamp || row.date;
  if (!raw) return null;
  const date = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function weeksCovered(rows) {
  const dates = rows.map(parseRowDate).filter(Boolean);
  if (!dates.length) return 1;

  const minTime = Math.min(...dates.map((date) => date.getTime()));
  const maxTime = Math.max(...dates.map((date) => date.getTime()));
  return Math.max(1, Math.ceil((maxTime - minTime + DAY_IN_MS) / WEEK_IN_MS));
}

function createBucket(taskCategory) {
  return {
    taskCategory,
    totalMinutes: 0,
    rowCount: 0,
    repetitiveTrueRows: 0,
    repetitiveFalseRows: 0,
    distinctEmployees: new Set(),
    recoverableRupeesRaw: 0,
  };
}

export function computeAutomationRanking(joinedRows = []) {
  const rows = Array.isArray(joinedRows) ? joinedRows : [];
  const totalDistinctEmployees = new Set(rows.map(employeeIdFor).filter(Boolean)).size || 1;
  const buckets = new Map();
  const coveredWeeks = weeksCovered(rows);
  const monthlyNormalizer = WEEKS_PER_MONTH / coveredWeeks;

  for (const row of rows) {
    const taskCategory = taskCategoryFor(row);
    const bucket = buckets.get(taskCategory) || createBucket(taskCategory);
    const durationMinutes = durationFor(row);

    bucket.totalMinutes += durationMinutes;
    bucket.rowCount += 1;
    bucket.distinctEmployees.add(employeeIdFor(row));

    if (row.is_repetitive === true) {
      bucket.repetitiveTrueRows += 1;
      const monthlyCompensationINR = compensationFor(row);

      if (monthlyCompensationINR !== null) {
        const recoverableMinutes = durationMinutes * AUTOMATION_RECOVERY_RATE;
        const perMinuteRate = monthlyCompensationINR / MINUTES_PER_WORKING_MONTH;
        bucket.recoverableRupeesRaw += recoverableMinutes * perMinuteRate;
      }
    } else if (row.is_repetitive === false) {
      bucket.repetitiveFalseRows += 1;
    }

    buckets.set(taskCategory, bucket);
  }

  const bucketList = [...buckets.values()];
  const maxMinutes = Math.max(...bucketList.map((bucket) => bucket.totalMinutes), 0) || 1;
  const maxRupees = Math.max(...bucketList.map((bucket) => bucket.recoverableRupeesRaw), 0) || 1;

  return bucketList
    .map((bucket) => {
      const repetitiveKnownRows = bucket.repetitiveTrueRows + bucket.repetitiveFalseRows;
      const volumeScore = bucket.totalMinutes / maxMinutes;
      const repetitivenessScore = repetitiveKnownRows ? bucket.repetitiveTrueRows / repetitiveKnownRows : 0;

      // This intentionally gives higher scores to tasks done by more people:
      // broad participation suggests a standardized workflow where one automation
      // can help many employees, rather than a person-specific niche task.
      const concentrationScore = bucket.distinctEmployees.size / totalDistinctEmployees;
      const rupeeImpactScore = bucket.recoverableRupeesRaw / maxRupees;
      const priorityScore =
        VOLUME_SCORE_WEIGHT * volumeScore +
        REPETITIVENESS_SCORE_WEIGHT * repetitivenessScore +
        CONCENTRATION_SCORE_WEIGHT * concentrationScore +
        RUPEE_IMPACT_SCORE_WEIGHT * rupeeImpactScore;

      return {
        taskCategory: bucket.taskCategory,
        priorityScore: roundTo(priorityScore, 3),
        subScores: {
          volumeScore: roundTo(volumeScore, 3),
          repetitivenessScore: roundTo(repetitivenessScore, 3),
          concentrationScore: roundTo(concentrationScore, 3),
          rupeeImpactScore: roundTo(rupeeImpactScore, 3),
        },
        rawStats: {
          totalMinutes: bucket.totalMinutes,
          totalHours: roundTo(bucket.totalMinutes / MINUTES_PER_HOUR, 1),
          distinctEmployeeCount: bucket.distinctEmployees.size,
          recoverableRupeesPerMonth: Math.round(bucket.recoverableRupeesRaw * monthlyNormalizer),
          rowCount: bucket.rowCount,
          insufficientRepetitiveData: repetitiveKnownRows === 0,
        },
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
}