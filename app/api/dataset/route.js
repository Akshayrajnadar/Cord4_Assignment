import { getDataset } from "@/lib/dataset";

export const dynamic = "force-static";

export async function GET() {
  return Response.json(getDataset());
}
