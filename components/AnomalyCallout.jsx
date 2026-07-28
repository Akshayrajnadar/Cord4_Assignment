export default function AnomalyCallout({ anomaly, anomalies }) {
  const selected = anomaly || (Array.isArray(anomalies) ? anomalies[0] : null);

  if (!selected) {
    return (
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <h2 className="font-semibold">Anomaly Callout</h2>
        <p className="mt-1">No significant anomalies detected in this period.</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 shadow-sm">
      <h2 className="font-semibold">Worth Investigating</h2>
      <p className="mt-2 text-base font-semibold leading-6">{selected.explanation}</p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-4">
        <div>
          <dt className="text-xs text-amber-700">Value</dt>
          <dd className="font-semibold">{selected.value}</dd>
        </div>
        <div>
          <dt className="text-xs text-amber-700">Mean</dt>
          <dd className="font-semibold">{selected.groupMean}</dd>
        </div>
        <div>
          <dt className="text-xs text-amber-700">Std dev</dt>
          <dd className="font-semibold">{selected.groupStdDev}</dd>
        </div>
        <div>
          <dt className="text-xs text-amber-700">Z-score</dt>
          <dd className="font-semibold">{selected.zScore}</dd>
        </div>
      </dl>
    </section>
  );
}