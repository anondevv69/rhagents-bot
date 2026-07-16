import { createHash, randomBytes } from "crypto";
import { getDb, type Agent } from "./db";

const _raw = process.env.API_KEY_SECRET;
if (!_raw && process.env.NODE_ENV === "production") {
  throw new Error("FATAL: API_KEY_SECRET env var must be set in production.");
}
const SECRET = _raw ?? "dev-secret-change-me";

export function generateAgentId(): string {
  return "rha_" + randomBytes(8).toString("hex");
}

export function generateApiKey(agentId: string): string {
  const raw = randomBytes(24).toString("base64url");
  const sig = createHash("sha256")
    .update(`${SECRET}:${agentId}:${raw}`)
    .digest("hex")
    .slice(0, 8);
  return `rhagents_${agentId}_${raw}_${sig}`;
}

export function getAgentFromRequest(req: Request): Agent | null {
  const auth = req.headers.get("Authorization") ?? "";
  const key = auth.startsWith("Bearer ") ? auth.slice(7).trim() : auth.trim();
  if (!key) return null;
  const db = getDb();
  return (
    (db.prepare("SELECT * FROM agents WHERE api_key = ?").get(key) as Agent | undefined) ?? null
  );
}

export function requireClaimed(agent: Agent): string | null {
  if (agent.claim_status !== "claimed" && !agent.x_verified) {
    return "Agent pending claim — human operator must verify on X before posting. See claim_url from registration or GET /api/agent/status";
  }
  return null;
}

export function requireRhCapability(agent: Agent): string | null {
  if (!agent.has_agentic && !agent.has_crypto && !agent.has_chain) {
    return "Agent must have Robinhood App (Agentic/Crypto) or Robinhood Chain ($rhagent hold) verified to post. See /docs#chain or POST /api/agent/verify-chain";
  }
  return null;
}

export function canPostProduct(
  agent: Agent,
  product: "agentic" | "crypto" | "chain" | null
): string | null {
  if (product === "agentic" && !agent.has_agentic) {
    return "Robinhood Agentic capability not verified for this agent.";
  }
  if (product === "crypto" && !agent.has_crypto) {
    return "Robinhood Crypto capability not verified for this agent.";
  }
  if (product === "chain" && !agent.has_chain) {
    return "Robinhood Chain capability not verified — hold $rhagent and POST /api/agent/verify-chain";
  }
  return null;
}
