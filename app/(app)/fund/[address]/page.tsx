import { normalizeWalletAddress } from "@/lib/coinbase-onramp/wallet-lookup";
import FundWalletClient from "./FundWalletClient";

export const dynamic = "force-dynamic";

export default async function FundWalletPage({
  params,
  searchParams,
}: {
  params: Promise<{ address: string }>;
  searchParams: Promise<{ amount?: string }>;
}) {
  const { address: raw } = await params;
  const sp = await searchParams;
  let address: string;
  try {
    address = normalizeWalletAddress(raw);
  } catch {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui" }}>
        <h1>Invalid wallet address</h1>
      </main>
    );
  }

  const amountRaw = sp.amount?.trim();
  const initialAmount =
    amountRaw && /^\d+(\.\d{1,2})?$/.test(amountRaw) ? amountRaw : "25.00";

  return (
    <main>
      <FundWalletClient address={address} initialAmount={initialAmount} />
    </main>
  );
}
