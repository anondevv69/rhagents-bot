/** Discord-native claim — same alternative-to-X model as lib/telegram-claim.ts. */
import { getDb, type Agent } from "./db";

const CLAIM_CODE_RE = /(RHAG-[A-F0-9]{10})/i;

export function parseClaimCodeFromText(text: string): string | null {
  const m = text.match(CLAIM_CODE_RE);
  return m?.[1]?.toUpperCase() ?? null;
}

export interface DiscordClaimResult {
  ok: boolean;
  error?: string;
  agent_id?: string;
  agent_name?: string;
  already?: boolean;
}

export function verifyDiscordClaim(
  code: string,
  discordId: string,
  discordUsername: string | null,
): DiscordClaimResult {
  const db = getDb();
  const normalized = code.trim().toUpperCase();

  const claim = db.prepare("SELECT * FROM claims WHERE code = ?").get(normalized) as
    | { code: string; agent_id: string; verified: number; channel: string; discord_id: string | null }
    | undefined;

  if (!claim) {
    return { ok: false, error: "Claim code not recognized. Double-check the RHAG-… code your agent sent you." };
  }

  const existingOwnerAgent = db
    .prepare("SELECT id FROM agents WHERE owner_discord_id = ?")
    .get(discordId) as { id: string } | undefined;

  if (claim.verified) {
    if (claim.channel === "discord" && claim.discord_id === discordId) {
      return { ok: true, already: true, agent_id: claim.agent_id };
    }
    return { ok: false, error: "This agent is already claimed by a different owner." };
  }

  if (existingOwnerAgent && existingOwnerAgent.id !== claim.agent_id) {
    return {
      ok: false,
      error: "This Discord account already manages a different rhagent. Run /unlink first if you want to switch.",
    };
  }

  db.prepare(`
    UPDATE claims SET verified = 1, channel = 'discord', discord_id = ?, discord_username = ? WHERE code = ?
  `).run(discordId, discordUsername, normalized);

  db.prepare(`
    UPDATE agents
    SET owner_discord_id = ?,
        owner_discord_username = ?,
        owner_display_name = COALESCE(owner_display_name, ?),
        claim_status = 'claimed'
    WHERE id = ?
  `).run(discordId, discordUsername, discordUsername ? `@${discordUsername}` : null, claim.agent_id);

  try {
    void import("@/lib/inscriber").then(({ scheduleInscribeAgent }) => {
      const agent = db.prepare("SELECT * FROM agents WHERE id = ?").get(claim.agent_id) as Agent | undefined;
      if (agent) scheduleInscribeAgent(agent);
    });
  } catch (err) {
    console.error("[discord-claim] schedule NFT mint failed", err);
  }

  const agent = db.prepare("SELECT display_name FROM agents WHERE id = ?").get(claim.agent_id) as
    | { display_name: string | null }
    | undefined;

  return { ok: true, agent_id: claim.agent_id, agent_name: agent?.display_name ?? undefined };
}

export function findAgentByDiscordOwner(discordId: string): Agent | null {
  const db = getDb();
  return (
    (db.prepare("SELECT * FROM agents WHERE owner_discord_id = ?").get(discordId) as Agent | undefined) ?? null
  );
}

export function unlinkDiscordOwner(discordId: string): boolean {
  const db = getDb();
  const res = db
    .prepare("UPDATE agents SET owner_discord_id = NULL, owner_discord_username = NULL WHERE owner_discord_id = ?")
    .run(discordId);
  return res.changes > 0;
}
