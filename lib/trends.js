const DAY_IN_MS = 24 * 60 * 60 * 1000;
const WEEK_IN_MS = 7 * DAY_IN_MS;

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
  return copy;
}

function formatWeekLabel(start, end) {
  const startMonth = start.toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" });
  const endMonth = end.toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" });
  const startDay = start.toLocaleDateString("en-IN", { day: "numeric", timeZone: "UTC" });
  const endDay = end.toLocaleDateString("en-IN", { day: "numeric", timeZone: "UTC" });
  return startMonth === endMonth ? `${startMonth} ${startDay}-${endDay}` : `${startMonth} ${startDay}-${endMonth} ${endDay}`;
}

function durationHours(rows) {
  const minutes = rows.reduce((sum, row) => {
    const parsed = Number(row.duration_minutes ?? row.durationMinutes ?? 0);
    return sum + (Number.isFinite(parsed) && parsed > 0 ? parsed : 0);
  }, 0);
  return Number((minutes / 60).toFixed(1));
}

export function computeWeeklyRepetitiveShare(joinedRows = []) {
  const rows = Array.isArray(joinedRows) ? joinedRows : [];
  const datedRows = rows
    .map((row) => ({ row, date: parseDate(row) }))
    .filter((item) => item.date);

  if (!datedRows.length) {
    return {
      trends: [],
      trendDirection: { direction: "flat", deltaPercentPoints: 0 },
    };
  }

  const minDate = new Date(Math.min(...datedRows.map((item) => item.date.getTime())));
  const maxDate = new Date(Math.max(...datedRows.map((item) => item.date.getTime())));
  let cursor = startOfIsoWeek(minDate);
  const lastWeekStart = startOfIsoWeek(maxDate);
  const buckets = new Map();

  // ISO weeks start on Monday. We create every week that intersects the actual
  // min/max data range, so short first/last weeks are included without inventing
  // calendar periods outside the uploaded activity window.
  while (cursor.getTime() <= lastWeekStart.getTime()) {
    const weekStart = new Date(cursor);
    const weekEnd = new Date(cursor.getTime() + 6 * DAY_IN_MS);
    buckets.set(weekStart.toISOString(), {
      weekStart,
      weekEnd,
      rows: [],
      includedRows: 0,
      trueRows: 0,
      unknownRows: 0,
    });
    cursor = new Date(cursor.getTime() + WEEK_IN_MS);
  }

  for (const { row, date } of datedRows) {
    const key = startOfIsoWeek(date).toISOString();
    const bucket = buckets.get(key);
    if (!bucket) continue;

    bucket.rows.push(row);
    if (row.is_repetitive === true || row.is_repetitive === false) {
      bucket.includedRows += 1;
      if (row.is_repetitive === true) bucket.trueRows += 1;
    } else {
      bucket.unknownRows += 1;
    }
  }

  const trends = [...buckets.values()].map((bucket) => ({
    weekLabel: formatWeekLabel(bucket.weekStart, bucket.weekEnd),
    weekStart: bucket.weekStart.toISOString(),
    weekEnd: bucket.weekEnd.toISOString(),
    repetitiveSharePercent: bucket.includedRows
      ? Number(((bucket.trueRows / bucket.includedRows) * 100).toFixed(1))
      : 0,
    totalHours: durationHours(bucket.rows),
    rowsIncluded: bucket.includedRows,
    rowsExcludedUnknown: bucket.unknownRows,
  }));

  const first = trends[0]?.repetitiveSharePercent || 0;
  const last = trends[trends.length - 1]?.repetitiveSharePercent || 0;
  const delta = Number((last - first).toFixed(1));
  const direction = Math.abs(delta) <= 2 ? "flat" : delta > 0 ? "increasing" : "decreasing";

  return {
    trends,
    trendDirection: {
      direction,
      deltaPercentPoints: delta,
    },
  };
}