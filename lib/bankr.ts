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

/**
 * Raw passthrough of Bankr's GET /wallet/me — address, chains, club status, and (per Bankr's
 * docs) the key's own permission flags. Exists because Bankr's API isn't CORS-enabled for
 * direct browser calls, so an agent that only has this wallet's api_key (not server access)
 * has no other way to check what its own key can do. Relayed verbatim, not parsed — Bankr
 * controls that schema and it can change; the caller reads whatever comes back.
 */
export async function getWalletMeRaw(bankrApiKey: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${BANKR_API}/wallet/me`, {
    headers: { "X-API-Key": bankrApiKey },
    signal: AbortSignal.timeout(8000),
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  return { status: res.status, body };
}

/** Bankr env var names configured for this agent (values never returned). */
export async function listBankrEnvKeys(bankrApiKey: string): Promise<string[]> {
  try {
    const res = await fetch(`${BANKR_API}/agent/env`, {
      headers: { "X-API-Key": bankrApiKey },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as unknown;
    if (Array.isArray(data)) {
      return data
        .map((x) => (typeof x === "string" ? x : (x as { key?: string })?.key))
        .filter((k): k is string => Boolean(k));
    }
    if (data && typeof data === "object" && Array.isArray((data as { keys?: string[] }).keys)) {
      return (data as { keys: string[] }).keys;
    }
    return [];
  } catch {
    return [];
  }
}

export interface BankrPortfolioSummary {
  total_usd: number | null;
  chains: string[];
  top_holdings: { symbol: string; usd: number; chain?: string }[];
  robinhood_chain_usd: number | null;
}

function parseUsd(value: unknown): number {
  const n = parseFloat(String(value ?? "0").replace(/[$,]/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

/** Normalize Bankr /wallet/portfolio JSON into a display-safe summary. */
export function summarizeBankrPortfolio(raw: unknown): BankrPortfolioSummary {
  const chains = new Set<string>();
  const holdings: { symbol: string; usd: number; chain?: string }[] = [];
  let totalUsd: number | null = null;
  let robinhoodChainUsd = 0;

  const walk = (node: unknown, chainHint = ""): void => {
    if (node == null) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, chainHint);
      return;
    }
    if (typeof node !== "object") return;
    const o = node as Record<string, unknown>;

    for (const k of ["totalValueUsd", "total_value_usd", "totalUsd", "total_usd", "netWorthUsd"]) {
      if (k in o) {
        const v = parseUsd(o[k]);
        if (v > 0) totalUsd = Math.max(totalUsd ?? 0, v);
      }
    }

    const chain =
      String(o.chain ?? o.network ?? o.chainName ?? chainHint ?? "")
        .trim()
        .toLowerCase() || undefined;
    if (chain) chains.add(chain);

    const symbol = String(o.symbol ?? o.ticker ?? o.tokenSymbol ?? o.name ?? "").trim();
    const usd = parseUsd(
      o.usdValue ?? o.valueUsd ?? o.value_usd ?? o.usd ?? o.fiatValue ?? o.balanceUsd,
    );
    if (symbol && usd >= 0.01) {
      holdings.push({ symbol: symbol.toUpperCase(), usd, chain });
      if (chain?.includes("robinhood")) robinhoodChainUsd += usd;
    }

    for (const [k, v] of Object.entries(o)) {
      if (k === "tokens" || k === "assets" || k === "holdings" || k === "balances") {
        walk(v, chain);
      } else if (typeof v === "object") {
        walk(v, chain);
      }
    }
  };

  walk(raw);
  holdings.sort((a, b) => b.usd - a.usd);

  if (totalUsd == null && holdings.length) {
    totalUsd = holdings.reduce((s, h) => s + h.usd, 0);
  }

  return {
    total_usd: totalUsd,
    chains: [...chains].sort(),
    top_holdings: holdings.slice(0, 8),
    robinhood_chain_usd: robinhoodChainUsd > 0 ? robinhoodChainUsd : null,
  };
}

/** Read-only Bankr portfolio — Robinhood Chain only (default for rhagent.bot link flow). */
export async function fetchBankrRobinhoodChainPortfolio(
  bankrApiKey: string,
): Promise<BankrPortfolioSummary | null> {
  try {
    const res = await fetch(`${BANKR_API}/wallet/portfolio?chains=robinhood`, {
      headers: { "X-API-Key": bankrApiKey },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return summarizeBankrPortfolio(data);
  } catch {
    return null;
  }
}

/** @deprecated Prefer fetchBankrRobinhoodChainPortfolio for owner settings. */
export async function fetchBankrPortfolio(bankrApiKey: string): Promise<BankrPortfolioSummary | null> {
  return fetchBankrRobinhoodChainPortfolio(bankrApiKey);
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
