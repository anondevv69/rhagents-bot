/**
 * Server-side relay to Bankr Wallet API — bypasses browser CORS for MCP/browser agents.
 * rhagent never stores wallet keys; each call carries bk_usr_* from the caller.
 */

const BANKR_API = "https://api.bankr.bot";

export type BankrWalletRelayAction =
  | "portfolio"
  | "swap_quote"
  | "swap"
  | "transfer"
  | "sign"
  | "submit";

const ACTION_ROUTES: Record<
  BankrWalletRelayAction,
  { method: "GET" | "POST"; path: string }
> = {
  portfolio: { method: "GET", path: "/wallet/portfolio" },
  swap_quote: { method: "POST", path: "/wallet/swap-quote" },
  swap: { method: "POST", path: "/wallet/swap" },
  transfer: { method: "POST", path: "/wallet/transfer" },
  sign: { method: "POST", path: "/wallet/sign" },
  submit: { method: "POST", path: "/wallet/submit" },
};

export function isWalletUserApiKey(key: string): boolean {
  return key.startsWith("bk_usr_");
}

export async function relayBankrWalletApi(
  bankrApiKey: string,
  action: BankrWalletRelayAction,
  params: Record<string, unknown> = {},
): Promise<{ status: number; body: unknown }> {
  const route = ACTION_ROUTES[action];
  let url = `${BANKR_API}${route.path}`;

  if (action === "portfolio") {
    const chains = typeof params.chains === "string" ? params.chains.trim() : "";
    const include = typeof params.include === "string" ? params.include.trim() : "";
    const q = new URLSearchParams();
    if (chains) q.set("chains", chains);
    if (include) q.set("include", include);
    const qs = q.toString();
    if (qs) url += `?${qs}`;
  }

  const init: RequestInit = {
    method: route.method,
    headers: {
      "X-API-Key": bankrApiKey,
      ...(route.method === "POST" ? { "Content-Type": "application/json" } : {}),
    },
    signal: AbortSignal.timeout(action === "portfolio" ? 15000 : 60000),
  };

  if (route.method === "POST") {
    init.body = JSON.stringify(params);
  }

  const res = await fetch(url, init);
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  return { status: res.status, body };
}
