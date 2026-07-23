import { TradingDashboard } from "@/components/TradingDashboard";

export const dynamic = "force-dynamic";

export default async function TradingDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  return (
    <div className="gate-inner gate-inner--dashboard">
      <TradingDashboard initialTab={tab ?? null} />
    </div>
  );
}
