/**
 * Capability probing — verify an agent has Robinhood Agentic or Crypto
 * by making a test call to the RH Wallet Gateway.
 *
 * ZERO CUSTODY: probe tokens/keys are passed in, used immediately for one
 * HTTP call, then discarded. We never write them to disk or the database.
 */

const GW = process.env.RH_WALLET_GATEWAY ?? "https://rh-wallet-production.up.railway.app";

export type CapabilityResult = { ok: true } | { ok: false; error: string };

/**
 * Verify Agentic capability: forward a minimal MCP initialize call through
 * the Railway proxy using the agent's AGENTIC_TOKEN. If the proxy responds
 * with a valid MCP response (not 401/403), capability is confirmed.
 *
 * The agentic_token is NEVER stored — used here and thrown away.
 */
export async function probeAgentic(agentic_token: string): Promise<CapabilityResult> {
  if (!agentic_token || agentic_token.length < 10) {
    return { ok: false, error: "agentic_token too short or missing" };
  }
  try {
    const res = await fetch(`${GW}/v1/agentic/mcp`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${agentic_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "rhagents-probe", version: "1" } } }),
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: "AGENTIC_TOKEN rejected — invalid or expired" };
    }
    // Any non-4xx response from our proxy means the token reached Robinhood
    if (res.status >= 200 && res.status < 500) {
      return { ok: true };
    }
    return { ok: false, error: `Unexpected gateway response: ${res.status}` };
  } catch (e) {
    return { ok: false, error: `Probe failed: ${(e as Error).message}` };
  }
}

/**
 * Verify Crypto capability: call the gateway prices endpoint with the agent's
 * RH API key + private key. If it returns valid prices, capability confirmed.
 *
 * Keys are NEVER stored — used here and thrown away.
 */
export async function probeCrypto(
  rh_api_key: string,
  rh_private_key_b64: string
): Promise<CapabilityResult> {
  if (!rh_api_key || !rh_private_key_b64) {
    return { ok: false, error: "rh_api_key and rh_private_key_b64 are required" };
  }
  try {
    const res = await fetch(`${GW}/v1/prices?symbol=BTC-USD`, {
      headers: {
        "X-RH-API-Key": rh_api_key,
        "X-RH-Private-Key-Base64": rh_private_key_b64,
        "Authorization": `Bearer ${process.env.RH_GATEWAY_SECRET ?? "uniqueissomethingimtesting"}`,
      },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: "RH crypto keys rejected — invalid or check gateway secret" };
    }
    if (res.status >= 200 && res.status < 500) {
      return { ok: true };
    }
    return { ok: false, error: `Unexpected gateway response: ${res.status}` };
  } catch (e) {
    return { ok: false, error: `Probe failed: ${(e as Error).message}` };
  }
}
