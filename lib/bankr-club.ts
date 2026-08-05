/**
 * Bankr Club ("rhagent Pro") — whitelabeled Club membership on a managed wallet.
 *
 * Flow: user deposits ~$20 USDC on Base into their managed wallet (Privy onramp can
 * target any address), then we ask the wallet's own agent to join Bankr Club paying
 * with that USDC. Club status is read from GET /wallet/me.
 *
 * Keys are used EPHEMERALLY: for provisioned wallets we mint a fresh key via the
 * partner API at call time; for linked terminal users the caller supplies bk_usr_*.
 * Nothing is persisted or logged.
 */

import { getWalletMeRaw } from "./bankr";
import { enableLlmGatewayOnWallet, isWalletApiKey } from "./bankr-provision";
import type { Agent } from "./db";

const BANKR_API = "https://api.bankr.bot";

/** Club membership price shown in UI — Bankr charges $20/mo (or $198/yr). */
export const BANKR_CLUB_MONTHLY_USD = 20;

export interface ClubStatus {
  /** true = active member, false = definitely not, null = Bankr didn't say */
  member: boolean | null;
  /** raw status string if Bankr returned one (e.g. "active", "expired") */
  status: string | null;
  expires_at: string | null;
}

/**
 * Extract club membership from Bankr's /wallet/me body. Bankr controls this schema;
 * we look for the fields they've used (clubStatus / bankrClub / club) and treat
 * anything unrecognized as unknown rather than "not a member".
 */
export function parseClubStatus(body: unknown): ClubStatus {
  const none: ClubStatus = { member: null, status: null, expires_at: null };
  if (!body || typeof body !== "object") return none;
  const o = body as Record<string, unknown>;

  const candidates: unknown[] = [o.clubStatus, o.club_status, o.bankrClub, o.club];
  for (const c of candidates) {
    if (c == null) continue;
    if (typeof c === "boolean") return { member: c, status: null, expires_at: null };
    if (typeof c === "string") {
      const s = c.toLowerCase();
      return {
        member: ["active", "member", "true", "yes"].includes(s)
          ? true
          : ["inactive", "none", "expired", "false", "no"].includes(s)
            ? false
            : null,
        status: c,
        expires_at: null,
      };
    }
    if (typeof c === "object") {
      const co = c as Record<string, unknown>;
      const active =
        typeof co.active === "boolean"
          ? co.active
          : typeof co.isMember === "boolean"
            ? co.isMember
            : typeof co.member === "boolean"
              ? co.member
              : null;
      const status = typeof co.status === "string" ? co.status : null;
      const expires =
        typeof co.expiresAt === "string"
          ? co.expiresAt
          : typeof co.expires_at === "string"
            ? co.expires_at
            : null;
      return {
        member: active ?? (status ? status.toLowerCase() === "active" : null),
        status,
        expires_at: expires,
      };
    }
  }
  if (typeof o.isClubMember === "boolean") {
    return { member: o.isClubMember, status: null, expires_at: null };
  }
  return none;
}

/** Read club status with a wallet API key (one /wallet/me call, key then discarded). */
export async function fetchClubStatus(bankrApiKey: string): Promise<ClubStatus | null> {
  try {
    const { status, body } = await getWalletMeRaw(bankrApiKey);
    if (status !== 200) return null;
    return parseClubStatus(body);
  } catch {
    return null;
  }
}

/**
 * Get a usable wallet API key for an agent's managed wallet.
 * Only possible for partner-provisioned wallets — mints a fresh key (Bankr never
 * re-exposes old key secrets). Returns null when the wallet isn't ours to key.
 */
export async function mintKeyForProvisionedWallet(agent: Agent): Promise<string | null> {
  if (!agent.bankr_provisioned) return null;
  const ref = agent.bankr_wallet_id || agent.bankr_wallet;
  if (!ref) return null;
  try {
    const { apiKey } = await enableLlmGatewayOnWallet(ref, "web");
    return apiKey ?? null;
  } catch {
    return null;
  }
}

/**
 * Ask the wallet's Bankr agent to join Bankr Club paying with USDC on Base.
 * This routes through /agent/prompt (natural language) — provisioned wallets have a
 * starter credit seed which covers this one prompt. Bankr executes asynchronously,
 * so callers should poll fetchClubStatus afterwards.
 */
export async function promptJoinClub(
  bankrApiKey: string,
): Promise<{ ok: boolean; status: number; reply: string | null }> {
  const res = await fetch(`${BANKR_API}/agent/prompt`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": bankrApiKey,
    },
    body: JSON.stringify({
      prompt:
        "Join Bankr Club with the monthly plan. Pay using the USDC balance on Base in this wallet.",
    }),
    signal: AbortSignal.timeout(30000),
  });
  const text = await res.text();
  let reply: string | null = null;
  try {
    const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    reply =
      typeof data.response === "string"
        ? data.response
        : typeof data.message === "string"
          ? data.message
          : typeof data.reply === "string"
            ? data.reply
            : null;
  } catch {
    reply = text ? text.slice(0, 300) : null;
  }
  return { ok: res.ok, status: res.status, reply };
}

/** Base USDC balance of a Bankr wallet (via /wallet/portfolio) — best effort. */
export async function fetchBaseUsdcBalance(bankrApiKey: string): Promise<number | null> {
  try {
    const res = await fetch(`${BANKR_API}/wallet/portfolio?chains=base`, {
      headers: { "X-API-Key": bankrApiKey },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    let usdc = 0;
    const walk = (node: unknown): void => {
      if (node == null) return;
      if (Array.isArray(node)) return node.forEach(walk);
      if (typeof node !== "object") return;
      const o = node as Record<string, unknown>;
      const symbol = String(o.symbol ?? o.ticker ?? "").toUpperCase();
      if (symbol === "USDC") {
        const v = parseFloat(String(o.usdValue ?? o.valueUsd ?? o.usd ?? o.balance ?? "0").replace(/[$,]/g, ""));
        if (!Number.isNaN(v)) usdc += v;
      }
      Object.values(o).forEach((v) => typeof v === "object" && walk(v));
    };
    walk(data);
    return usdc;
  } catch {
    return null;
  }
}

export { isWalletApiKey };
