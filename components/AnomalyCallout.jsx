export default function AnomalyCallout({ anomalies }) {
  if (!anomalies.length) return null;

  return (
    <section className="rounded-lg border border-[#c98447] bg-[#fff7ed] p-4 text-sm text-[#5d3920]">
      <h2 className="font-semibold">Anomaly Callout</h2>
      <p className="mt-1">
        {anomalies[0].employeeName} had {anomalies[0].reason} in {anomalies[0].app} for {" "}
        {anomalies[0].durationMinutes} minutes on {anomalies[0].date}.
      </p>
    </section>
  );
}
