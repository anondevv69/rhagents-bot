/**
 * Capability probing — verify Robinhood Agentic or Crypto access.
 *
 * Accepts registration when ANY of:
 *   - buying power / cash > $0
 *   - open holdings / positions
 *   - trade / order history
 *
 * ZERO CUSTODY: credentials used for probe only, then discarded.
 */

import { callAgenticMcpTool } from "@/lib/robinhood-agentic";

const GW = process.env.RH_WALLET_GATEWAY ?? "https://rhwallet-rhagent-production.up.railway.app";

export type ProofType = "balance" | "holdings" | "trade_history" | "symbol_quote";

export type CapabilityOk = {
  ok: true;
  buying_power_usd: number;
  mcp_connected: boolean;
  proof_type: ProofType;
};

export type CapabilityResult = CapabilityOk | { ok: false; error: string };

function cryptoHeaders(rh_api_key: string, rh_private_key_b64: string) {
  return {
    "X-RH-API-Key": rh_api_key,
    "X-RH-Private-Key-Base64": rh_private_key_b64,
    Authorization: `Bearer ${process.env.RH_GATEWAY_SECRET ?? "dev-gateway-secret"}`,
  };
}

async function agenticTool(token: string, name: string, args: Record<string, unknown> = {}) {
  const result = await callAgenticMcpTool(token, name, args);
  if (!result.ok) return null;
  return result.body;
}

function parseUsd(value: unknown): number {
  const n = parseFloat(String(value ?? "0").replace(/[$,]/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

/** Walk MCP/gateway JSON for buying power, portfolio value, non-empty lists */
function analyzeMcpActivity(body: unknown): {
  buyingPower: number;
  portfolioValue: number;
  hasHoldings: boolean;
  hasTradeHistory: boolean;
} {
  let buyingPower = 0;
  let portfolioValue = 0;
  let hasHoldings = false;
  let hasTradeHistory = false;

  const walk = (v: unknown, keyHint = ""): void => {
    if (v == null) return;

    if (typeof v === "string") {
      try {
        walk(JSON.parse(v), keyHint);
        return;
      } catch {
        const lower = v.toLowerCase();
        if (/no (open )?(positions|holdings|orders)/.test(lower)) return;
        if (/order history|filled|executed|position/i.test(v)) hasTradeHistory = true;
        if (/quantity.*[1-9]/i.test(v)) hasHoldings = true;
        const bp = v.match(/buying[_\s-]?power[^0-9$]*[\$]?([\d,.]+)/i);
        if (bp?.[1]) buyingPower = Math.max(buyingPower, parseUsd(bp[1]));
        const pv = v.match(/portfolio[^0-9$]*[\$]?([\d,.]+)/i);
        if (pv?.[1]) portfolioValue = Math.max(portfolioValue, parseUsd(pv[1]));
        return;
      }
    }

    if (Array.isArray(v)) {
      if (v.length === 0) return;
      const hint = keyHint.toLowerCase();
      if (/order|fill|trade|execution/.test(hint)) hasTradeHistory = true;
      if (/position|holding|equity|option|asset/.test(hint)) hasHoldings = true;
      for (const item of v) walk(item, keyHint);
      return;
    }

    if (typeof v === "object") {
      const o = v as Record<string, unknown>;
      if ("content" in o && Array.isArray(o.content)) {
        for (const block of o.content) {
          if (block && typeof block === "object" && "text" in block) {
            walk((block as { text: string }).text, keyHint);
          }
        }
      }
      if ("buying_power" in o || "buyingPower" in o) {
        buyingPower = Math.max(buyingPower, parseUsd(o.buying_power ?? o.buyingPower));
      }
      if ("portfolio_value" in o || "portfolioValue" in o || "total_value" in o) {
        portfolioValue = Math.max(
          portfolioValue,
          parseUsd(o.portfolio_value ?? o.portfolioValue ?? o.total_value)
        );
      }
      if ("quantity" in o && parseUsd(o.quantity) > 0) hasHoldings = true;
      if ("state" in o && /filled|executed|confirmed/i.test(String(o.state))) hasTradeHistory = true;
      if ("side" in o && ("symbol" in o || "instrument" in o)) hasTradeHistory = true;

      for (const [k, val] of Object.entries(o)) {
        if (k === "results" && Array.isArray(val) && val.length > 0) {
          if (/order|trade/.test(keyHint)) hasTradeHistory = true;
          else hasHoldings = true;
        }
        walk(val, k);
      }
    }
  };

  walk(body);
  return { buyingPower, portfolioValue, hasHoldings, hasTradeHistory };
}

function pickProof(activity: ReturnType<typeof analyzeMcpActivity>): CapabilityOk | null {
  const { buyingPower, portfolioValue, hasHoldings, hasTradeHistory } = activity;
  const balance = Math.max(buyingPower, portfolioValue);

  if (balance > 0) {
    return {
      ok: true,
      buying_power_usd: balance,
      mcp_connected: true,
      proof_type: "balance",
    };
  }
  if (hasHoldings) {
    return {
      ok: true,
      buying_power_usd: 0,
      mcp_connected: true,
      proof_type: "holdings",
    };
  }
  if (hasTradeHistory) {
    return {
      ok: true,
      buying_power_usd: 0,
      mcp_connected: true,
      proof_type: "trade_history",
    };
  }
  return null;
}

/**
 * Verify Agentic: MCP + portfolio/positions/orders.
 * Pass if balance > 0 OR holdings OR trade history.
 */
export async function probeAgentic(agentic_token: string): Promise<CapabilityResult> {
  if (!agentic_token || agentic_token.length < 10) {
    return { ok: false, error: "agentic_token too short or missing" };
  }

  try {
    const sessionProbe = await callAgenticMcpTool(agentic_token, "get_portfolio", {});
    if (!sessionProbe.ok) {
      if (sessionProbe.status === 401 || sessionProbe.status === 403) {
        return {
          ok: false,
          error: "AGENTIC_TOKEN rejected — invalid or expired. Re-run rh-connect.sh",
        };
      }
      if (sessionProbe.status >= 500) {
        return { ok: false, error: `Agentic gateway error: ${sessionProbe.status}` };
      }
    }

    const merged: ReturnType<typeof analyzeMcpActivity> = {
      buyingPower: 0,
      portfolioValue: 0,
      hasHoldings: false,
      hasTradeHistory: false,
    };

    const tools = [
      "get_portfolio",
      "get_equity_positions",
      "get_equity_orders",
      "get_option_positions",
    ] as const;

    for (const tool of tools) {
      const body = await agenticTool(agentic_token, tool);
      if (!body) continue;
      const a = analyzeMcpActivity(body);
      merged.buyingPower = Math.max(merged.buyingPower, a.buyingPower);
      merged.portfolioValue = Math.max(merged.portfolioValue, a.portfolioValue);
      merged.hasHoldings = merged.hasHoldings || a.hasHoldings;
      merged.hasTradeHistory = merged.hasTradeHistory || a.hasTradeHistory;

      const proof = pickProof(merged);
      if (proof) return proof;
    }

    return {
      ok: false,
      error:
        "No Agentic activity found — need buying power > $0, open positions, or trade history. Fund account or place a trade first.",
    };
  } catch (e) {
    return { ok: false, error: `Agentic probe failed: ${(e as Error).message}` };
  }
}

async function cryptoGet(path: string, rh_api_key: string, rh_private_key_b64: string) {
  const res = await fetch(`${GW}${path}`, {
    headers: cryptoHeaders(rh_api_key, rh_private_key_b64),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function analyzeCryptoResults(data: unknown): {
  buyingPower: number;
  hasHoldings: boolean;
  hasTradeHistory: boolean;
} {
  let buyingPower = 0;
  let hasHoldings = false;
  let hasTradeHistory = false;

  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if ("buying_power" in o) buyingPower = parseUsd(o.buying_power);
    const results = o.results;
    if (Array.isArray(results) && results.length > 0) {
      for (const r of results) {
        if (r && typeof r === "object") {
          const row = r as Record<string, unknown>;
          if (parseUsd(row.quantity ?? row.total_quantity) > 0) hasHoldings = true;
          if (row.side || row.state || row.id) hasTradeHistory = true;
        }
      }
      if (!hasTradeHistory && results.length > 0) hasHoldings = true;
    }
  }

  return { buyingPower, hasHoldings, hasTradeHistory };
}

/**
 * Verify Crypto: balance > 0 OR holdings OR order history.
 */
export async function probeCrypto(
  rh_api_key: string,
  rh_private_key_b64: string
): Promise<CapabilityResult> {
  if (!rh_api_key || !rh_private_key_b64) {
    return { ok: false, error: "rh_api_key and rh_private_key_b64 are required" };
  }

  try {
    const accountRes = await fetch(`${GW}/v1/account`, {
      headers: cryptoHeaders(rh_api_key, rh_private_key_b64),
      signal: AbortSignal.timeout(10000),
    });

    if (accountRes.status === 401 || accountRes.status === 403) {
      return { ok: false, error: "RH crypto keys rejected — invalid or expired" };
    }
    if (!accountRes.ok) {
      return { ok: false, error: `Crypto gateway error: ${accountRes.status}` };
    }

    const account = await accountRes.json();
    let state = analyzeCryptoResults(account);

    if (state.buyingPower > 0) {
      return {
        ok: true,
        buying_power_usd: state.buyingPower,
        mcp_connected: false,
        proof_type: "balance",
      };
    }

    const holdings = await cryptoGet("/v1/holdings", rh_api_key, rh_private_key_b64);
    if (holdings) {
      const h = analyzeCryptoResults(holdings);
      if (h.hasHoldings) {
        return {
          ok: true,
          buying_power_usd: state.buyingPower,
          mcp_connected: false,
          proof_type: "holdings",
        };
      }
    }

    const orders = await cryptoGet("/v1/orders", rh_api_key, rh_private_key_b64);
    if (orders) {
      const o = analyzeCryptoResults(orders);
      if (o.hasTradeHistory || (Array.isArray((orders as { results?: unknown[] }).results) && (orders as { results: unknown[] }).results.length > 0)) {
        return {
          ok: true,
          buying_power_usd: state.buyingPower,
          mcp_connected: false,
          proof_type: "trade_history",
        };
      }
    }

    return {
      ok: false,
      error:
        "No Crypto activity found — need buying power > $0, crypto holdings, or past orders. Fund account or place a trade first.",
    };
  } catch (e) {
    return { ok: false, error: `Crypto probe failed: ${(e as Error).message}` };
  }
}
