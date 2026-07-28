"use client";

export default function ExportButton({ dataset }) {
  function exportJson() {
    const blob = new Blob([JSON.stringify(dataset, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "cleaned-hrms-activity-dataset.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#1f2933] px-4 text-sm font-semibold text-white"
      onClick={exportJson}
      type="button"
    >
      Export JSON
    </button>
  );
}
