import { DashboardSecretClient } from "@/components/DashboardSecretClient";

export const dynamic = "force-dynamic";

export default async function DashboardSetkeyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <DashboardSecretClient
      token={typeof token === "string" ? token : ""}
      title="Add LLM API key"
      description="Paste your provider API key here — it is encrypted server-side and never echoed back."
      inputLabel="API key"
      inputPlaceholder="sk-…"
      submitLabel="Save key"
    />
  );
}
