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
 * Does this viewer session own this agent? X / Telegram / Discord owner fields, or a matching
 * claimed Chain wallet (wallet-first accounts).
 */
export function viewerOwnsAgent(
  session:
    | {
        x_handle?: string | null;
        telegram_id?: string | null;
        discord_id?: string | null;
        chain_wallet?: string | null;
      }
    | null
    | undefined,
  agent: {
    owner_x_handle: string | null;
    owner_telegram_id?: string | null;
    owner_discord_id?: string | null;
    chain_wallet?: string | null;
    bankr_wallet?: string | null;
    x_verified?: number;
    claim_status?: string;
  },
): boolean {
  if (!session) return false;
  // claim_status='claimed' covers X, Telegram, Discord, and wallet claims; x_verified===1 keeps the
  // legacy "pending manual review" X path (owner_x_handle set, not yet verified) locked out.
  const claimed = agent.claim_status === "claimed" || agent.x_verified === 1;
  if (!claimed) return false;
  if (session.x_handle && agent.owner_x_handle && normHandle(session.x_handle) === normHandle(agent.owner_x_handle)) {
    return true;
  }
  if (session.telegram_id && agent.owner_telegram_id && session.telegram_id === agent.owner_telegram_id) {
    return true;
  }
  if (session.discord_id && agent.owner_discord_id && session.discord_id === agent.owner_discord_id) {
    return true;
  }
  if (
    session.chain_wallet &&
    agent.chain_wallet &&
    session.chain_wallet.toLowerCase() === agent.chain_wallet.toLowerCase()
  ) {
    return true;
  }
  // Bankr-provisioned agents: a wallet session (from personal_sign or a bk_usr_… key,
  // both of which prove control of that wallet) owns the claimed agent whose Bankr
  // wallet matches — same trust bar as the chain_wallet match above.
  if (
    session.chain_wallet &&
    agent.bankr_wallet &&
    session.chain_wallet.toLowerCase() === agent.bankr_wallet.toLowerCase()
  ) {
    return true;
  }
  return false;
}

/** Logged-in human (not guest) — X, Telegram, Discord, or MetaMask Chain wallet. */
export function viewerHasIdentity(
  session:
    | {
        x_handle?: string | null;
        telegram_id?: string | null;
        discord_id?: string | null;
        chain_wallet?: string | null;
        guest_id?: string | null;
      }
    | null
    | undefined,
): boolean {
  if (!session) return false;
  return !!(
    session.x_handle ||
    session.telegram_id ||
    session.discord_id ||
    session.chain_wallet
  );
}

/** Rate-limit / log identity key for a viewer session. */
export function viewerIdentityKey(
  session: {
    x_handle?: string | null;
    telegram_id?: string | null;
    discord_id?: string | null;
    chain_wallet?: string | null;
  },
): string {
  return (
    session.telegram_id ??
    session.discord_id ??
    session.x_handle ??
    session.chain_wallet?.toLowerCase() ??
    "anon"
  );
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
