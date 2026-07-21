/**
 * Live Robinhood balance summaries for owner settings (ephemeral credentials only).
 */

const GW = process.env.RH_WALLET_GATEWAY ?? "https://rhwallet-rhagent-production.up.railway.app";

function parseUsd(value: unknown): number {
  const n = parseFloat(String(value ?? "0").replace(/[$,]/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

function cryptoHeaders(rh_api_key: string, rh_private_key_b64: string) {
  return {
    "X-RH-API-Key": rh_api_key,
    "X-RH-Private-Key-Base64": rh_private_key_b64,
    Authorization: `Bearer ${process.env.RH_GATEWAY_SECRET ?? "dev-gateway-secret"}`,
  };
}

async function agenticTool(token: string, name: string, args: Record<string, unknown> = {}) {
  const res = await fetch(`${GW}/v1/agentic/mcp`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "tools/call", params: { name, arguments: args } }),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function extractAgenticUsd(body: unknown): { portfolio: number; buyingPower: number } {
  let portfolio = 0;
  let buyingPower = 0;

  const walk = (v: unknown): void => {
    if (v == null) return;
    if (typeof v === "string") {
      try {
        walk(JSON.parse(v));
      } catch {
        const bp = v.match(/buying[_\s-]?power[^0-9$]*[\$]?([\d,.]+)/i);
        if (bp?.[1]) buyingPower = Math.max(buyingPower, parseUsd(bp[1]));
        const pv = v.match(/portfolio[^0-9$]*[\$]?([\d,.]+)/i);
        if (pv?.[1]) portfolio = Math.max(portfolio, parseUsd(pv[1]));
      }
      return;
    }
    if (Array.isArray(v)) {
      for (const item of v) walk(item);
      return;
    }
    if (typeof v === "object") {
      const o = v as Record<string, unknown>;
      if ("buying_power" in o || "buyingPower" in o) {
        buyingPower = Math.max(buyingPower, parseUsd(o.buying_power ?? o.buyingPower));
      }
      if ("portfolio_value" in o || "portfolioValue" in o || "total_value" in o) {
        portfolio = Math.max(
          portfolio,
          parseUsd(o.portfolio_value ?? o.portfolioValue ?? o.total_value),
        );
      }
      for (const val of Object.values(o)) walk(val);
    }
  };

  walk(body);
  return { portfolio, buyingPower };
}

export async function fetchAgenticBalanceSummary(agenticToken: string): Promise<{
  portfolio_usd: number | null;
  buying_power_usd: number | null;
  summary: string | null;
  error: string | null;
}> {
  if (!agenticToken || agenticToken.length < 10) {
    return {
      portfolio_usd: null,
      buying_power_usd: null,
      summary: null,
      error: "agentic_token missing or too short",
    };
  }

  try {
    const body = await agenticTool(agenticToken, "get_portfolio", {});
    if (!body) {
      return {
        portfolio_usd: null,
        buying_power_usd: null,
        summary: null,
        error: "Could not reach Agentic MCP — re-run rh-connect.sh",
      };
    }
    const { portfolio, buyingPower } = extractAgenticUsd(body);
    const pv = portfolio > 0 ? portfolio : null;
    const bp = buyingPower > 0 ? buyingPower : null;
    const parts: string[] = [];
    if (pv != null) parts.push(`$${pv.toFixed(2)} portfolio`);
    if (bp != null) parts.push(`$${bp.toFixed(2)} buying power`);
    return {
      portfolio_usd: pv,
      buying_power_usd: bp,
      summary: parts.length ? `Robinhood Agentic · ${parts.join(" · ")}` : "Robinhood Agentic · connected (no balance parsed)",
      error: null,
    };
  } catch (e) {
    return {
      portfolio_usd: null,
      buying_power_usd: null,
      summary: null,
      error: e instanceof Error ? e.message : "Agentic fetch failed",
    };
  }
}

export async function fetchCryptoBalanceSummary(
  rhApiKey: string,
  rhPrivateKeyB64: string,
): Promise<{
  buying_power_usd: number | null;
  summary: string | null;
  error: string | null;
}> {
  try {
    const res = await fetch(`${GW}/v1/account`, {
      headers: cryptoHeaders(rhApiKey, rhPrivateKeyB64),
      signal: AbortSignal.timeout(10000),
    });
    if (res.status === 401 || res.status === 403) {
      return { buying_power_usd: null, summary: null, error: "Robinhood Crypto keys rejected" };
    }
    if (!res.ok) {
      return { buying_power_usd: null, summary: null, error: `Crypto gateway error: ${res.status}` };
    }
    const data = await res.json();
    const bp = parseUsd((data as { buying_power?: unknown }).buying_power);
    return {
      buying_power_usd: bp > 0 ? bp : null,
      summary:
        bp > 0
          ? `Robinhood Crypto · $${bp.toFixed(2)} buying power`
          : "Robinhood Crypto · connected ($0 buying power)",
      error: null,
    };
  } catch (e) {
    return {
      buying_power_usd: null,
      summary: null,
      error: e instanceof Error ? e.message : "Crypto fetch failed",
    };
  }
}
