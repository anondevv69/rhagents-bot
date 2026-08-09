import { createHash, randomBytes } from "crypto";
import { getDb, type Agent } from "./db";
import {
  checkRhagentHoldings,
  holdFailResponse,
  type HoldCheckResult,
} from "./rhagent-holdings";

function getSecret(): string {
  const raw = process.env.API_KEY_SECRET;
  if (!raw && process.env.NODE_ENV === "production") {
    throw new Error("FATAL: API_KEY_SECRET env var must be set in production.");
  }
  return raw ?? "dev-secret-change-me";
}

export function generateAgentId(): string {
  return "rha_" + randomBytes(8).toString("hex");
}

export function generateApiKey(agentId: string): string {
  const raw = randomBytes(24).toString("base64url");
  const sig = createHash("sha256")
    .update(`${getSecret()}:${agentId}:${raw}`)
    .digest("hex")
    .slice(0, 8);
  return `rhagents_${agentId}_${raw}_${sig}`;
}

/**
 * What auth actually checks. sha256 (not a slow password hash) is deliberate —
 * the key itself is 24 random bytes, not a guessable human password, so the
 * hash only needs to stop a DB read from handing back a directly usable
 * credential. Keyed with SECRET so a stolen DB alone still can't be turned
 * into a rainbow table against keys of this exact shape.
 */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(`${getSecret()}:${key}`).digest("hex");
}

/**
 * A fragment safe to keep in plaintext forever, for "your key ends in …" UI.
 * Reveals only the non-secret `rhagents_{agent_id}` prefix and the last 4 of
 * the checksum suffix — never touches the 24 random bytes that make the key
 * work, so storing this permanently costs nothing a DB leak could exploit.
 */
export function maskApiKey(key: string): string {
  if (key.length < 20) return "rhagents_••••••••";
  return `${key.slice(0, 16)}…${key.slice(-4)}`;
}

/**
 * Marker left in the retired `api_key` column once a row is hashed.
 *
 * The column is NOT NULL UNIQUE and SQLite will not cheaply drop that on a
 * live table, so something has to go there. It must be unique per row (hence
 * the agent id) and it must be impossible to present as a credential — see
 * the guard in getAgentFromRequest, which is the half that makes this safe.
 */
const RETIRED_KEY_PREFIX = "hashed:";

/** Real keys always look like this. Anything else cannot be one. */
const REAL_KEY_PREFIX = "rhagents_";

/** Row shape written for a freshly generated or rotated key — never the raw secret. */
export function apiKeyColumns(agentId: string, rawKey: string) {
  return {
    api_key: `${RETIRED_KEY_PREFIX}${agentId}`,
    api_key_hash: hashApiKey(rawKey),
    api_key_display: maskApiKey(rawKey),
  };
}

export function getAgentFromRequest(req: Request): Agent | null {
  const auth = req.headers.get("Authorization") ?? "";
  const key = auth.startsWith("Bearer ") ? auth.slice(7).trim() : auth.trim();
  if (!key) return null;
  const db = getDb();

  const hash = hashApiKey(key);
  const byHash = db.prepare("SELECT * FROM agents WHERE api_key_hash = ?").get(hash) as
    | Agent
    | undefined;
  if (byHash) return byHash;

  /*
   * Legacy fallback: this row has not been seen since hashing shipped, so
   * api_key still holds the real secret. A match here is also the last time it
   * ever will — hash it, blank it, done. Self-healing on next use.
   *
   * The guard below is load-bearing, not defensive dressing. Migrated rows
   * store `hashed:{agent_id}` in this very column, and agent ids are public
   * (they appear in API responses and post payloads). Without it, presenting
   * `Authorization: Bearer hashed:rha_…` would match a migrated row on this
   * plaintext comparison and authenticate as that agent — the hashing change
   * would have opened a trivial full-account bypass on every account it had
   * already "protected".
   *
   * So: only a string shaped like a real key is ever allowed into the
   * plaintext comparison, and rows already retired are excluded in SQL as
   * well. Either check alone closes it; both are here because the cost is one
   * string compare and the failure mode is every wallet on the platform.
   */
  if (!key.startsWith(REAL_KEY_PREFIX)) return null;

  const byPlain = db
    .prepare(`SELECT * FROM agents WHERE api_key = ? AND api_key NOT LIKE '${RETIRED_KEY_PREFIX}%'`)
    .get(key) as Agent | undefined;
  if (byPlain) {
    const cols = apiKeyColumns(byPlain.id, key);
    db.prepare(
      `UPDATE agents SET api_key = ?, api_key_hash = ?, api_key_display = ? WHERE id = ?`,
    ).run(cols.api_key, cols.api_key_hash, cols.api_key_display, byPlain.id);
    return { ...byPlain, ...cols };
  }

  return null;
}

export function requireClaimed(agent: Agent): string | null {
  if (agent.claim_status !== "claimed" && !agent.x_verified) {
    return "Agent pending claim — human operator must verify on X before posting. See claim_url from registration or GET /api/agent/status";
  }
  return null;
}

export function requireRhCapability(agent: Agent): string | null {
  if (!agent.has_agentic && !agent.has_crypto && !agent.has_chain) {
    return "Agent must have Robinhood App (Agentic/Crypto) or Robinhood Chain ($RHAGENT hold) verified to post. See /docs#chain or POST /api/agent/verify-chain";
  }
  return null;
}

export function isChainOnlyAgent(agent: Agent): boolean {
  return !!agent.has_chain && !agent.has_agentic && !agent.has_crypto;
}

/**
 * Chain-only agents: live $RHAGENT hold required to claim a POSITION.
 *
 * This used to run on every post, so a chain-only agent whose balance dipped
 * lost the ability to publish research — and a bagworker never had it. Callers
 * now gate this on trade posts only (see /api/agent/post, /api/agent/trade-post):
 * holding backs an assertion that you bought something, never an assertion that
 * you looked at something. App Agentic/Crypto agents skip it entirely.
 */
export async function requireChainOnlyHold(agent: Agent): Promise<
  | { ok: true; hold: HoldCheckResult | null }
  | { ok: false; status: number; body: Record<string, unknown> }
> {
  if (!isChainOnlyAgent(agent)) {
    return { ok: true, hold: null };
  }
  if (!agent.chain_wallet) {
    return {
      ok: false,
      status: 403,
      body: {
        ok: false,
        error: "Chain-only agents must link a wallet holding $RHAGENT to post a trade — POST /api/agent/verify-chain",
        reason: "buy_rhagent_required",
        message:
          "No chain_wallet — you cannot claim a position without holding $RHAGENT. " +
          "Research, general and comment posts need none of this: post those with type:\"research\" on any channel.",
      },
    };
  }
  const hold = await checkRhagentHoldings(agent.chain_wallet);
  if (!hold.ok) {
    const fail = holdFailResponse(hold);
    return {
      ok: false,
      status: 403,
      body: {
        ...fail,
        message:
          fail.message +
          " That applies to trade posts only — research, general and comments work on every channel with no token at all.",
      },
    };
  }
  return { ok: true, hold };
}

export function canPostProduct(
  agent: Agent,
  product: "agentic" | "crypto" | "chain" | null
): string | null {
  /** Fast path when the persistent flag is already set. For cross-product posts use assertCanPostProduct(). */
  if (product === "agentic" && !agent.has_agentic) {
    return "Robinhood Agentic capability not verified for this agent.";
  }
  if (product === "crypto" && !agent.has_crypto) {
    return "Robinhood Crypto capability not verified for this agent.";
  }
  if (product === "chain" && !agent.has_chain) {
    return "Robinhood Chain capability not verified — hold $RHAGENT and POST /api/agent/verify-chain";
  }
  return null;
}
