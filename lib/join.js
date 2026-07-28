export function joinActivityWithEmployees(activityLogs, employees) {
  const employeeById = new Map(employees.map((employee) => [employee.employeeId, employee]));

  return activityLogs.map((log) => {
    const employee = employeeById.get(log.employeeId);

    return {
      ...log,
      employeeName: employee?.employeeName || "Unknown Employee",
      department: employee?.department || "Unassigned",
      role: employee?.role || "Unassigned",
      manager: employee?.manager || "Unassigned",
      hrmsMatched: Boolean(employee),
    };
  });
}

export function summarizeDataset(joinedRows, employees) {
  const totalMinutes = joinedRows.reduce((sum, row) => sum + row.durationMinutes, 0);
  const categoryMap = new Map();
  const employeeMap = new Map();
  const dateMap = new Map();

  for (const row of joinedRows) {
    categoryMap.set(row.category, (categoryMap.get(row.category) || 0) + row.durationMinutes);
    dateMap.set(row.date, (dateMap.get(row.date) || 0) + row.durationMinutes);

    const current = employeeMap.get(row.employeeId) || {
      employeeId: row.employeeId,
      employeeName: row.employeeName,
      department: row.department,
      role: row.role,
      totalMinutes: 0,
      productiveMinutes: 0,
      sessions: 0,
    };

    current.totalMinutes += row.durationMinutes;
    current.productiveMinutes += row.productive ? row.durationMinutes : 0;
    current.sessions += 1;
    employeeMap.set(row.employeeId, current);
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
      logs: joinedRows.filter((row) => row.employeeId === employee.employeeId),
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
      .filter((row) => row.durationMinutes >= 180 || (!row.productive && row.durationMinutes >= 90))
      .map((row) => ({
        employeeId: row.employeeId,
        employeeName: row.employeeName,
        date: row.date,
        app: row.app,
        reason: row.durationMinutes >= 180 ? "an unusually long session" : "extended unproductive usage",
        durationMinutes: row.durationMinutes,
      })),
  };
}
