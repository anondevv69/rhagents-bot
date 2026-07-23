import { DashboardSecretClient } from "@/components/DashboardSecretClient";

export const dynamic = "force-dynamic";

export default async function DashboardConnectAgenticPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <DashboardSecretClient
      token={typeof token === "string" ? token : ""}
      title="Connect Robinhood Agentic"
      description="Paste your Agentic MCP token from Robinhood. It is encrypted and stored securely."
      inputLabel="Agentic token"
      inputPlaceholder="Paste MCP token"
      submitLabel="Connect Agentic"
    />
  );
}
