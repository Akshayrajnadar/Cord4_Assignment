import AnomalyCallout from "@/components/AnomalyCallout";
import Breakdown from "@/components/Breakdown";
import ChatAssistant from "@/components/ChatAssistant";
import EmployeeDrilldown from "@/components/EmployeeDrilldown";
import ExportButton from "@/components/ExportButton";
import HeadlineNumbers from "@/components/HeadlineNumbers";
import RankingTable from "@/components/RankingTable";
import TrendChart from "@/components/TrendChart";
import { getDataset } from "@/lib/dataset";

export default function DashboardPage() {
  const dataset = getDataset();

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-[#1d1d1b]">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-[#d7d0c4] pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#7b5f32]">
              HRMS Activity Intelligence
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-[#1f2933] md:text-4xl">
              Workforce Usage Dashboard
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5f5b53]">
              Cleaned application logs reconciled with HRMS employee records.
            </p>
          </div>
          <ExportButton dataset={dataset} />
        </header>

        <HeadlineNumbers metrics={dataset.headlineMetrics} />
        <AnomalyCallout anomaly={dataset.anomaly} />

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <TrendChart trends={dataset.weeklyTrends} trendDirection={dataset.trendDirection} />
          <Breakdown categories={dataset.categoryBreakdown} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <RankingTable employees={dataset.employeeRankings} />
          <EmployeeDrilldown joinedRows={dataset.rows} employees={dataset.employees} />
        </div>

        <ChatAssistant />
      </section>
    </main>
  );
}
