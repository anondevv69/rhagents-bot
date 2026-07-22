import type { NextRequest } from "next/server";
import { canPostProduct, requireRhCapability } from "@/lib/auth";
import { extractAgenticToken } from "@/lib/agentic-token";
import { extractCryptoCredentials } from "@/lib/crypto-credentials";
import { probeAgentic, probeCrypto } from "@/lib/capability";
import { getDb, type Agent } from "@/lib/db";

export type ProductPostLiveContext = {
  agenticToken?: string | null;
  rhApiKey?: string | null;
  rhPrivateKeyB64?: string | null;
};

export function extractLiveProductContext(
  req: NextRequest | Request,
  body?: Record<string, unknown>,
): ProductPostLiveContext {
  const crypto = extractCryptoCredentials(req, body);
  return {
    agenticToken: extractAgenticToken(req, body),
    rhApiKey: crypto.rhApiKey,
    rhPrivateKeyB64: crypto.rhPrivateKeyB64,
  };
}

function persistAgenticCapability(agentId: string, proof: { buying_power_usd: number; mcp_connected: boolean; proof_type: string }) {
  getDb()
    .prepare(
      "UPDATE agents SET has_agentic = 1, buying_power_usd = ?, mcp_connected = ?, capability_proof = ? WHERE id = ?",
    )
    .run(proof.buying_power_usd, proof.mcp_connected ? 1 : 0, proof.proof_type, agentId);
}

function persistCryptoCapability(agentId: string, proof: { buying_power_usd: number; proof_type: string }) {
  getDb()
    .prepare("UPDATE agents SET has_crypto = 1, buying_power_usd = ?, capability_proof = ? WHERE id = ?")
    .run(proof.buying_power_usd, proof.proof_type, agentId);
}

/**
 * Either/or registration + connected product pass-through:
 * - Registered with crypto, chain, or agentic → may post any App product once live creds prove access.
 * - Persistent flags (has_agentic / has_crypto) set on first successful live probe.
 */
export async function assertCanPostProduct(
  agent: Agent,
  product: "agentic" | "crypto" | "chain",
  live?: ProductPostLiveContext,
): Promise<string | null> {
  if (product === "chain") {
    return canPostProduct(agent, "chain");
  }

  const registered = canPostProduct(agent, product);
  if (!registered) {
    return null;
  }

  const baseErr = requireRhCapability(agent);
  if (baseErr) {
    return baseErr;
  }

  if (product === "agentic") {
    const token = live?.agenticToken?.trim();
    if (!token) {
      return "Robinhood Agentic capability not connected — POST /api/agent/verify-capabilities with agentic_token, or pass X-Agentic-Token on this request.";
    }
    const probe = await probeAgentic(token);
    if (!probe.ok) {
      return probe.error;
    }
    persistAgenticCapability(agent.id, probe);
    return null;
  }

  const rhApiKey = live?.rhApiKey?.trim();
  const rhPrivateKeyB64 = live?.rhPrivateKeyB64?.trim();
  if (!rhApiKey || !rhPrivateKeyB64) {
    return "Robinhood Crypto capability not connected — POST /api/agent/verify-capabilities with rh_api_key + rh_private_key_b64, or pass those headers on this request.";
  }
  const probe = await probeCrypto(rhApiKey, rhPrivateKeyB64);
  if (!probe.ok) {
    return probe.error;
  }
  persistCryptoCapability(agent.id, probe);
  return null;
}
