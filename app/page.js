import DashboardClient from "@/components/DashboardClient";
import { getDataset } from "@/lib/dataset";

export default function DashboardPage() {
  const dataset = getDataset();

  return <DashboardClient dataset={dataset} />;
}