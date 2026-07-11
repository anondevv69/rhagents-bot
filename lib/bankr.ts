/**
 * Bankr API client — read-only identity resolution.
 * Never used to store or forward user keys.
 */

const BANKR_API = "https://api.bankr.bot";

export interface BankrProfile {
  xUsername: string | null;
  walletAddress: string | null;
}

/** Resolve an EVM wallet address from a Bankr API key (read-only /wallet/me) */
export async function resolveWalletMe(bankrApiKey: string): Promise<string | null> {
  try {
    const res = await fetch(`${BANKR_API}/wallet/me`, {
      headers: { "X-API-Key": bankrApiKey },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { wallets?: { chain: string; address: string }[] };
    return data.wallets?.find((w) => w.chain === "evm")?.address ?? null;
  } catch {
    return null;
  }
}

/** Resolve an X handle from a Bankr EVM wallet address */
export async function resolveXHandle(walletAddress: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${BANKR_API}/addresses/resolve?value=${encodeURIComponent(walletAddress)}&type=wallet`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = await res.json() as { xUsername?: string };
    return data.xUsername ?? null;
  } catch {
    return null;
  }
}

/** Resolve a wallet from an X handle */
export async function resolveWalletFromX(xHandle: string): Promise<string | null> {
  try {
    const handle = xHandle.replace(/^@/, "");
    const res = await fetch(
      `${BANKR_API}/addresses/resolve?value=${encodeURIComponent(handle)}&type=twitter`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = await res.json() as { address?: string };
    return data.address ?? null;
  } catch {
    return null;
  }
}
