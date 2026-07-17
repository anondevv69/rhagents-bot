import Link from "next/link";
import {
  tradingTelegramBotUsername,
  tradingTelegramDeepLink,
} from "@/lib/telegram-bots";

export const dynamic = "force-dynamic";

function tradingDiscordInviteUrl(): string | null {
  const appId =
    process.env.TRADING_DISCORD_APPLICATION_ID?.trim() ||
    process.env.NEXT_PUBLIC_TRADING_DISCORD_APPLICATION_ID?.trim();
  if (!appId) return null;
  // bot + slash commands; Send Messages so job DMs / replies work in servers
  const permissions = "2048";
  const scope = encodeURIComponent("bot applications.commands");
  return `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(appId)}&permissions=${permissions}&scope=${scope}`;
}

export default function DiscordTradingInstallPage() {
  const invite = tradingDiscordInviteUrl();
  const tradingTg = tradingTelegramBotUsername();
  const tradingTgUrl = tradingTelegramDeepLink();

  return (
    <div className="gate-inner gate-inner--wide">
      <div className="gate-card">
        <p className="panel-label" style={{ marginBottom: 8 }}>
          Trading agent
        </p>
        <h1 className="page-header-title">Add rhagent on Discord</h1>
        <p className="owner-settings-note">
          Same trading agent as Telegram — connect Robinhood Crypto/Agentic, schedule jobs, confirm
          orders, and open the dashboard with <code>/website</code>. Your vault can later be linked
          to Telegram with <code>/link_telegram</code>.
        </p>

        {invite ? (
          <p style={{ marginTop: 20 }}>
            <a className="btn btn-primary" href={invite}>
              Add to Discord
            </a>
          </p>
        ) : (
          <p className="trading-dash-notice" style={{ marginTop: 16 }}>
            Install link is not configured yet — set{" "}
            <code>TRADING_DISCORD_APPLICATION_ID</code> on rhagent.bot (the trading Discord app&apos;s
            Application ID), then redeploy.
          </p>
        )}

        <ol className="owner-settings-note" style={{ marginTop: 20, paddingLeft: 18 }}>
          <li>Click Add to Discord and authorize the bot.</li>
          <li>
            In Discord, run <code>/start</code> or <code>/help</code>.
          </li>
          <li>
            When ready, <code>/website</code> opens your settings on rhagent.bot.
          </li>
        </ol>

        <p className="owner-settings-note" style={{ marginTop: 16 }}>
          Prefer Telegram?{" "}
          {tradingTg && tradingTgUrl ? (
            <>
              Open{" "}
              <a href={tradingTgUrl} className="text-link" target="_blank" rel="noreferrer">
                @{tradingTg}
              </a>
              , then use <code>/website</code> the same way.
            </>
          ) : (
            <>
              Talk to the trading Telegram bot (not the site claim bot), then use{" "}
              <code>/website</code> the same way.
            </>
          )}{" "}
          <Link href="/dashboard" className="text-link">
            Dashboard
          </Link>
          {" · "}
          <Link href="/terms" className="text-link">
            Terms
          </Link>
          {" · "}
          <Link href="/privacy" className="text-link">
            Privacy
          </Link>
        </p>
      </div>
    </div>
  );
}
