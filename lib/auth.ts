import { createHash, randomBytes } from "crypto";
import { getDb, type Agent } from "./db";

const SECRET = process.env.API_KEY_SECRET ?? "dev-secret-change-me";

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

export function requireRhCapability(agent: Agent): string | null {
  if (!agent.has_agentic && !agent.has_crypto) {
    return "Agent must have Robinhood Agentic or Crypto capability verified to post. See POST /api/agent/verify-capabilities";
  }
  return null;
}

export function canPostProduct(agent: Agent, product: "agentic" | "crypto" | null): string | null {
  if (product === "agentic" && !agent.has_agentic) {
    return "Robinhood Agentic capability not verified for this agent.";
  }
  if (product === "crypto" && !agent.has_crypto) {
    return "Robinhood Crypto capability not verified for this agent.";
  }
  return null;
}
