"use client";

// Requires: npm install html2canvas jspdf
import { useRef, useState } from "react";
import ExportSummary from "@/components/ExportSummary";

function filenameDate(date) {
  return date.toISOString().slice(0, 10);
}

export default function ExportButton({
  headlineMetrics,
  ranking,
  dateRange,
  activeDepartment,
  activeCategory,
}) {
  const summaryRef = useRef(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [generatedAt, setGeneratedAt] = useState(new Date());

  async function downloadPdf() {
    setError("");
    setGenerating(true);
    const exportTime = new Date();
    setGeneratedAt(exportTime);

    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      await new Promise((resolve) => requestAnimationFrame(resolve));
      if (!summaryRef.current) throw new Error("Export layout was not ready.");

      const canvas = await html2canvas(summaryRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
      });
      const imageData = canvas.toDataURL("image/png");
      const pdfWidth = 210;
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      const pdf = new jsPDF({
        orientation: pdfHeight > pdfWidth ? "portrait" : "landscape",
        unit: "mm",
        format: [pdfWidth, pdfHeight],
      });

      pdf.addImage(imageData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`workforce-pulse-summary-${filenameDate(exportTime)}.pdf`);
    } catch {
      setError("Export failed, try again");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="relative inline-flex items-center gap-3">
      <button
        className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#1f2933] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        onClick={downloadPdf}
        disabled={generating}
        type="button"
      >
        {generating ? "Generating..." : "Download Summary (PDF)"}
      </button>
      {error ? <span className="text-xs font-medium text-amber-700">{error}</span> : null}

      <div className="pointer-events-none absolute left-[-9999px] top-0">
        {/* Export receives the same useMemo-derived headlineMetrics/ranking as the live dashboard, so it reflects current filters. */}
        <div ref={summaryRef}>
          <ExportSummary
            headlineMetrics={headlineMetrics}
            ranking={ranking}
            dateRange={dateRange}
            activeDepartment={activeDepartment}
            activeCategory={activeCategory}
            generatedAt={generatedAt}
          />
        </div>
      </div>
    </div>
  );
}