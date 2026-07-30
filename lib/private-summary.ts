import type { Agent } from "@/lib/db";
import {
  computeAgentPnl,
  formatPortfolioSummary,
  getAgentTradeRows,
  utcDayStart,
  type AgentPnlStats,
  type PortfolioPeriod,
} from "@/lib/pnl";
import { parseStoredWalletSnapshot, type WalletSnapshot } from "@/lib/wallet-snapshot";

const PRIVACY_NOTE =
  "Owner-only view via your RHAGENTS_AGENT_KEY. Nothing here is posted to the feed or shown on your public profile. " +
  "For live open stock/option positions and buying power, use Robinhood Trading MCP get_portfolio in the same private chat.";

function statsPayload(stats: AgentPnlStats) {
  const winRate =
    stats.closedTrades > 0 ? Math.round((stats.wins / stats.closedTrades) * 100) : null;
  return {
    realized_pnl_usd: Math.round(stats.realizedPnlUsd * 100) / 100,
    buy_count: stats.buyCount,
    sell_count: stats.sellCount,
    fill_count: stats.buyCount + stats.sellCount,
    total_volume_usd: Math.round(stats.totalVolumeUsd * 100) / 100,
    open_lots: stats.openLots,
    closed_trades: stats.closedTrades,
    win_rate_pct: winRate,
  };
}

function formatChainLine(snapshot: WalletSnapshot | null): string | null {
  const rc = snapshot?.robinhood_chain;
  if (!rc) return null;
  const parts: string[] = [];
  if (rc.total_usd != null) parts.push(`~$${rc.total_usd.toFixed(2)} on Robinhood Chain`);
  if (rc.rhagent_tokens != null && rc.rhagent_tokens > 0) {
    parts.push(
      `${rc.rhagent_tokens.toLocaleString()} RHAGENT${
        rc.rhagent_value_usd != null ? ` (~$${rc.rhagent_value_usd.toFixed(2)})` : ""
      }`,
    );
  }
  if (rc.tokens.length) {
    const top = rc.tokens
      .slice(0, 5)
      .map((t) => `${t.symbol}${t.usd > 0 ? ` ~$${t.usd.toFixed(2)}` : ""}`)
      .join(", ");
    parts.push(top);
  }
  return parts.length ? parts.join(" · ") : "Robinhood Chain wallet linked — no token lines yet";
}

function formatAppLine(snapshot: WalletSnapshot | null): string | null {
  const app = snapshot?.robinhood_app;
  if (!app) return null;
  const lines: string[] = [];
  if (app.agentic.summary) lines.push(`Agentic: ${app.agentic.summary}`);
  else if (app.agentic.registered) lines.push("Agentic: registered on rhagent.bot");
  if (app.crypto.summary) lines.push(`Crypto: ${app.crypto.summary}`);
  else if (app.crypto.registered) lines.push("Crypto: registered on rhagent.bot");
  return lines.length ? lines.join(" · ") : null;
}

/** Plain-text block for Claude/Telegram — Reddit-bot style but explicitly private. */
export function formatPrivateSummaryText(input: {
  snapshot: WalletSnapshot | null;
  snapshotAt: string | null;
  todayStats: AgentPnlStats;
  lifetimeStats: AgentPnlStats;
}): string {
  const lines: string[] = [
    "PRIVATE SUMMARY (owner only — not on your public profile)",
    "",
  ];

  const appLine = formatAppLine(input.snapshot);
  if (appLine) {
    lines.push(appLine);
  } else if (input.snapshot) {
    lines.push(
      "Robinhood App: no cached brokerage line — refresh_wallet_snapshot with bankr_api_key + optional agentic_token, " +
        "or ask Robinhood MCP get_portfolio for live holdings.",
    );
  }

  const chainLine = formatChainLine(input.snapshot);
  if (chainLine) lines.push(chainLine);

  lines.push("");
  lines.push(formatPortfolioSummary(input.todayStats, "today"));
  lines.push("");
  lines.push(formatPortfolioSummary(input.lifetimeStats, "lifetime"));

  if (input.snapshotAt) {
    lines.push("");
    lines.push(`Wallet snapshot cached: ${input.snapshotAt}`);
  } else {
    lines.push("");
    lines.push(
      "No wallet snapshot cached yet — call refresh_wallet_snapshot with bankr_api_key (keys never stored).",
    );
  }

  lines.push("");
  lines.push(PRIVACY_NOTE);
  return lines.join("\n");
}

export interface PrivateAgentSummary {
  privacy_note: string;
  agent: { id: string; username: string | null; bankr_wallet: string | null };
  rhagents_pnl: {
    today: ReturnType<typeof statsPayload> & { summary: string; since: string };
    lifetime: ReturnType<typeof statsPayload> & { summary: string };
  };
  wallet_snapshot: WalletSnapshot | null;
  wallet_snapshot_at: string | null;
  formatted_summary: string;
  public_profile_note: string;
}

export function buildPrivateAgentSummary(agent: Agent): PrivateAgentSummary {
  const trades = getAgentTradeRows(agent.id);
  const since = utcDayStart();
  const todayStats = computeAgentPnl(trades, { since });
  const lifetimeStats = computeAgentPnl(trades);
  const snapshot = parseStoredWalletSnapshot(agent.bankr_wallet_snapshot);

  return {
    privacy_note: PRIVACY_NOTE,
    agent: {
      id: agent.id,
      username: agent.username,
      bankr_wallet: agent.bankr_wallet,
    },
    rhagents_pnl: {
      today: {
        ...statsPayload(todayStats),
        summary: formatPortfolioSummary(todayStats, "today"),
        since,
      },
      lifetime: {
        ...statsPayload(lifetimeStats),
        summary: formatPortfolioSummary(lifetimeStats, "lifetime"),
      },
    },
    wallet_snapshot: snapshot,
    wallet_snapshot_at: agent.bankr_wallet_snapshot_at ?? null,
    formatted_summary: formatPrivateSummaryText({
      snapshot,
      snapshotAt: agent.bankr_wallet_snapshot_at ?? null,
      todayStats,
      lifetimeStats,
    }),
    public_profile_note:
      "Your public /agent profile shows posted trade cards and aggregate realized P&L from fills only — " +
      "not live Robinhood positions, chain balances, or this combined summary.",
  };
}
