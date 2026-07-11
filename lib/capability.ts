/**
 * Capability probing — verify Robinhood Agentic or Crypto access.
 *
 * ZERO CUSTODY: credentials are used for probe calls only, then discarded.
 * We store ONLY: buying_power snapshot + boolean capability flags.
 * We NEVER store: API keys, tokens, private keys, or account numbers.
 */

const GW = process.env.RH_WALLET_GATEWAY ?? "https://rh-wallet-production.up.railway.app";

export type CapabilityOk = {
  ok: true;
  buying_power_usd: number;
  mcp_connected: boolean;
};

export type CapabilityResult = CapabilityOk | { ok: false; error: string };

async function agenticMcp(token: string, method: string, params: Record<string, unknown> = {}) {
  const res = await fetch(`${GW}/v1/agentic/mcp`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
    signal: AbortSignal.timeout(12000),
  });
  return res;
}

/**
 * Verify Agentic: MCP initialize + get_portfolio for buying power > 0.
 * Token is NEVER stored.
 */
export async function probeAgentic(agentic_token: string): Promise<CapabilityResult> {
  if (!agentic_token || agentic_token.length < 10) {
    return { ok: false, error: "agentic_token too short or missing" };
  }

  try {
    const init = await agenticMcp(agentic_token, "initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "rhagents-probe", version: "1" },
    });

    if (init.status === 401 || init.status === 403) {
      return { ok: false, error: "AGENTIC_TOKEN rejected — invalid or expired. Re-run rh-connect.sh" };
    }
    if (init.status >= 500) {
      return { ok: false, error: `Agentic gateway error: ${init.status}` };
    }

    const portfolio = await agenticMcp(agentic_token, "tools/call", {
      name: "get_portfolio",
      arguments: {},
    });

    if (portfolio.status === 401 || portfolio.status === 403) {
      return { ok: false, error: "MCP connected but get_portfolio unauthorized — check AGENTIC_TOKEN" };
    }

    let buyingPower = 0;
    try {
      const body = await portfolio.json();
      buyingPower = extractBuyingPowerFromMcp(body) ?? 0;
    } catch {
      return { ok: false, error: "Could not parse Agentic portfolio response" };
    }

    if (buyingPower <= 0) {
      return {
        ok: false,
        error: "Agentic buying power is $0 — fund your Agentic account before registering",
      };
    }

    return { ok: true, buying_power_usd: buyingPower, mcp_connected: true };
  } catch (e) {
    return { ok: false, error: `Agentic probe failed: ${(e as Error).message}` };
  }
}

function extractBuyingPowerFromMcp(body: unknown): number | null {
  const walk = (v: unknown): number | null => {
    if (v == null) return null;
    if (typeof v === "string") {
      try {
        return walk(JSON.parse(v));
      } catch {
        const m = v.match(/buying[_\s-]?power[^0-9$]*[\$]?([\d,.]+)/i)
          ?? v.match(/cash[^0-9$]*[\$]?([\d,.]+)/i);
        return m?.[1] ? parseFloat(m[1].replace(/,/g, "")) : null;
      }
    }
    if (typeof v === "object") {
      const o = v as Record<string, unknown>;
      for (const k of ["buying_power", "buyingPower", "cash"]) {
        if (k in o) {
          const n = parseFloat(String(o[k]).replace(/[$,]/g, ""));
          if (!Number.isNaN(n)) return n;
        }
      }
      if (o.result) return walk(o.result);
      if (o.content) return walk(o.content);
      for (const val of Object.values(o)) {
        const n = walk(val);
        if (n != null) return n;
      }
    }
    return null;
  };
  return walk(body);
}

/**
 * Verify Crypto: account buying power > 0 via RH Wallet Gateway.
 * Keys are NEVER stored.
 */
export async function probeCrypto(
  rh_api_key: string,
  rh_private_key_b64: string
): Promise<CapabilityResult> {
  if (!rh_api_key || !rh_private_key_b64) {
    return { ok: false, error: "rh_api_key and rh_private_key_b64 are required" };
  }

  try {
    const res = await fetch(`${GW}/v1/account`, {
      headers: {
        "X-RH-API-Key": rh_api_key,
        "X-RH-Private-Key-Base64": rh_private_key_b64,
        Authorization: `Bearer ${process.env.RH_GATEWAY_SECRET ?? "uniqueissomethingimtesting"}`,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: "RH crypto keys rejected — invalid or expired" };
    }
    if (!res.ok) {
      return { ok: false, error: `Crypto gateway error: ${res.status}` };
    }

    const data = (await res.json()) as { buying_power?: string };
    const buyingPower = parseFloat(String(data.buying_power ?? "0").replace(/[$,]/g, ""));

    if (Number.isNaN(buyingPower) || buyingPower <= 0) {
      return {
        ok: false,
        error: "Crypto buying power is $0 — fund your Robinhood crypto account before registering",
      };
    }

    return { ok: true, buying_power_usd: buyingPower, mcp_connected: false };
  } catch (e) {
    return { ok: false, error: `Crypto probe failed: ${(e as Error).message}` };
  }
}
