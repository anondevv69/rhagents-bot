import { DashboardSaveClient } from "@/components/DashboardSaveClient";

export const dynamic = "force-dynamic";

export default async function DashboardSavePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <DashboardSaveClient token={typeof token === "string" ? token : ""} />;
}
