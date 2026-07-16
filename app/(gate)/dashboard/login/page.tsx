import { DashboardLoginClient } from "@/components/DashboardLoginClient";

export const dynamic = "force-dynamic";

export default async function DashboardLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  return <DashboardLoginClient code={typeof code === "string" ? code : ""} />;
}
