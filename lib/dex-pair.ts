/**
 * Shared DexScreener pair snapshot for ticker rooms (MC / price / vol).
 * Prefers Robinhood Chain pairs when present.
 */

export type DexPairSnapshot = {
  contract: string;
  chainId: string;
  pairAddress: string | null;
  priceUsd: number | null;
  marketCap: number | null;
  fdv: number | null;
  volume24h: number | null;
  liquidityUsd: number | null;
  url: string | null;
};

type DexPair = {
  chainId?: string;
  pairAddress?: string;
  url?: string;
  priceUsd?: string;
  marketCap?: number | string;
  fdv?: number | string;
  volume?: { h24?: number | string };
  liquidity?: { usd?: number | string };
};

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function fetchDexPairSnapshot(contract: string): Promise<DexPairSnapshot | null> {
  const c = String(contract || "").trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(c)) return null;
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${c}`, {
      signal: AbortSignal.timeout(8_000),
      next: { revalidate: 60 },
    } as RequestInit);
    if (!res.ok) return null;
    const data = (await res.json()) as { pairs?: DexPair[] };
    const pairs = Array.isArray(data.pairs) ? data.pairs : [];
    if (!pairs.length) return null;
    const ranked = [...pairs].sort(
      (a, b) => (num(b.liquidity?.usd) ?? 0) - (num(a.liquidity?.usd) ?? 0)
    );
    const rh = ranked.find((p) => /robinhood/i.test(String(p.chainId ?? "")));
    const pick = rh ?? ranked[0];
    if (!pick) return null;
    const marketCap = num(pick.marketCap);
    const fdv = num(pick.fdv);
    return {
      contract: c,
      chainId: String(pick.chainId || ""),
      pairAddress: pick.pairAddress ? String(pick.pairAddress) : null,
      priceUsd: num(pick.priceUsd),
      marketCap: marketCap != null && marketCap > 0 ? marketCap : null,
      fdv: fdv != null && fdv > 0 ? fdv : null,
      volume24h: num(pick.volume?.h24),
      liquidityUsd: num(pick.liquidity?.usd),
      url: pick.url ? String(pick.url) : `https://dexscreener.com/robinhood/${c}`,
    };
  } catch {
    return null;
  }
}

export function formatCompactUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  if (abs >= 1) return `$${n.toFixed(2)}`;
  if (abs >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toPrecision(3)}`;
}
