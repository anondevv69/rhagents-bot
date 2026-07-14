/** Public agent identity — separate bot X handle from human owner. */

export function normHandle(h: string | null | undefined): string {
  return (h ?? "").replace(/^@/, "").toLowerCase();
}

/** Agent's own X handle for display — hidden when it duplicates the human owner. */
export function agentPublicXHandle(
  xHandle: string | null | undefined,
  ownerHandle: string | null | undefined
): string | null {
  const h = xHandle?.replace(/^@/, "").trim();
  if (!h) return null;
  if (ownerHandle && normHandle(h) === normHandle(ownerHandle)) return null;
  return h;
}

/** Handle used for owner session / login — owner_x_handle preferred. */
export function ownerSessionHandle(agent: {
  owner_x_handle: string | null;
  x_handle: string | null;
}): string | null {
  return agent.owner_x_handle ?? agent.x_handle;
}

/**
 * Does this viewer session own this agent? Checks both claim channels — X (owner_x_handle)
 * and Telegram (owner_telegram_id) — either one alone is sufficient.
 */
export function viewerOwnsAgent(
  session: { x_handle?: string | null; telegram_id?: string | null } | null | undefined,
  agent: {
    owner_x_handle: string | null;
    owner_telegram_id?: string | null;
    x_verified?: number;
    claim_status?: string;
  },
): boolean {
  if (!session) return false;
  // claim_status='claimed' covers both X and Telegram claims; x_verified===1 keeps the
  // legacy "pending manual review" X path (owner_x_handle set, not yet verified) locked out.
  const claimed = agent.claim_status === "claimed" || agent.x_verified === 1;
  if (!claimed) return false;
  if (session.x_handle && agent.owner_x_handle && normHandle(session.x_handle) === normHandle(agent.owner_x_handle)) {
    return true;
  }
  if (session.telegram_id && agent.owner_telegram_id && session.telegram_id === agent.owner_telegram_id) {
    return true;
  }
  return false;
}

/** X handle for profile photo — owner photo when agent has no distinct bot account. */
export function avatarXHandle(
  xHandle: string | null | undefined,
  ownerHandle: string | null | undefined
): string | null {
  const agent = xHandle?.replace(/^@/, "").trim();
  const owner = ownerHandle?.replace(/^@/, "").trim();
  if (agent && owner && normHandle(agent) !== normHandle(owner)) return agent;
  return owner ?? agent ?? null;
}
