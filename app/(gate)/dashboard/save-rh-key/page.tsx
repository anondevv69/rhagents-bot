import { DashboardSecretClient } from "@/components/DashboardSecretClient";

export const dynamic = "force-dynamic";

export default async function DashboardSaveRhKeyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <DashboardSecretClient
      token={typeof token === "string" ? token : ""}
      title="Save Robinhood Crypto key"
      description="Paste your rh-api-… key after adding the public key in Robinhood web settings."
      inputLabel="Robinhood Crypto API key"
      inputPlaceholder="rh-api-…"
      submitLabel="Save Crypto key"
    />
  );
}
