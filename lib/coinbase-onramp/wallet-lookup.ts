import { getDb, type Agent } from "@/lib/db";
import { findAgentByDiscordOwner } from "@/lib/discord-claim";
import { findAgentByTelegramOwner } from "@/lib/telegram-claim";
import { HttpError } from "@/lib/coinbase-onramp/deposit-routes";

export interface ResolvedWallet {
  address: string;
  network: string;
  agent_id: string;
}

export type DepositPlatform = "telegram" | "discord" | "agent";

export function resolveAgentForPlatform(
  platform: DepositPlatform,
  platformUserId: string,
): Agent | null {
  const id = platformUserId.trim();
  if (!id) return null;
  if (platform === "telegram") return findAgentByTelegramOwner(id);
  if (platform === "discord") return findAgentByDiscordOwner(id);
  return (getDb().prepare(`SELECT * FROM agents WHERE id = ?`).get(id) as Agent | undefined) ?? null;
}

/** Coinbase onramp destination — uses linked Bankr wallet address from agents table. */
export async function resolveWalletAddress(params: {
  platform: DepositPlatform;
  platformUserId: string;
}): Promise<ResolvedWallet> {
  const agent = resolveAgentForPlatform(params.platform, params.platformUserId);
  if (!agent) {
    throw new HttpError(
      404,
      "No rhagent linked to this account — register and link Telegram/Discord first.",
    );
  }
  const wallet = agent.bankr_wallet?.trim();
  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    throw new HttpError(
      400,
      "No Bankr wallet on this agent — run provision_wallet (or /register_rhagents on the trading bot) first.",
    );
  }

  return {
    address: wallet,
    network: process.env.COINBASE_ONRAMP_NETWORK?.trim() || "base",
    agent_id: agent.id,
  };
}
