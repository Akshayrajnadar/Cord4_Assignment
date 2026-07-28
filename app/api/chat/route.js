import { getDataset } from "@/lib/dataset";

function buildAnswer(message, dataset) {
  const question = message.toLowerCase();
  const topEmployee = dataset.employeeRankings[0];
  const topCategory = dataset.categoryBreakdown[0];
  const latestAnomaly = dataset.anomalies[0];

  if (question.includes("anomal")) {
    return latestAnomaly
      ? `${latestAnomaly.employeeName} shows ${latestAnomaly.reason} on ${latestAnomaly.date}.`
      : "No anomalies are present in the cleaned dataset.";
  }

  if (question.includes("top") || question.includes("rank")) {
    return `${topEmployee.employeeName} ranks highest with ${topEmployee.totalMinutes} active minutes across ${topEmployee.sessions} sessions.`;
  }

  if (question.includes("category") || question.includes("app")) {
    return `${topCategory.category} is the largest category at ${topCategory.minutes} minutes, representing ${topCategory.share}% of tracked time.`;
  }

  return `The dataset covers ${dataset.metrics.totalEmployees} employees, ${dataset.metrics.totalSessions} sessions, and ${dataset.metrics.totalHours} active hours. Ask about anomalies, rankings, apps, or categories for a grounded answer.`;
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message : "";

  if (!message.trim()) {
    return Response.json(
      { error: "Send a message to query the dataset." },
      { status: 400 },
    );
  }

  return Response.json({
    answer: buildAnswer(message, getDataset()),
    grounded: true,
  });
}
