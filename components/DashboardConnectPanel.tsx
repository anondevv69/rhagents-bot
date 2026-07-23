"use client";

import { useCallback, useState } from "react";
import { CopyBlock } from "@/components/setup-ui";
import { tradingTelegramDeepLink } from "@/lib/telegram-bots";

type ConnectPayload = {
  startParam: string;
  deepLinkTelegram: string | null;
  ttlMinutes: number;
};

export function DashboardConnectPanel({
  platformLinked,
  busy,
  onConnected,
}: {
  platformLinked?: boolean;
  busy?: boolean;
  onConnected?: () => void;
}) {
  const [telegram, setTelegram] = useState<ConnectPayload | null>(null);
  const [discordCode, setDiscordCode] = useState<ConnectPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const issueCode = useCallback(
    async (platform: "telegram" | "discord") => {
      setLoading(platform);
      setError(null);
      try {
        const res = await fetch("/api/dashboard/connect-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platform }),
        });
        const body = (await res.json().catch(() => ({}))) as ConnectPayload & { ok?: boolean; error?: string };
        if (!res.ok || !body.ok || !body.startParam) {
          throw new Error(body.error || "Could not create connect code.");
        }
        if (platform === "telegram") setTelegram(body);
        else setDiscordCode(body);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      } finally {
        setLoading(null);
      }
    },
    [],
  );

  if (platformLinked) {
    return (
      <p className="owner-settings-note muted">
        Telegram or Discord connected — chat and dashboard share one account.
      </p>
    );
  }

  const tgLink =
    telegram?.deepLinkTelegram ??
    (telegram?.startParam ? tradingTelegramDeepLink(telegram.startParam) : null);

  return (
    <div className="panel trading-dash-connect">
      <h2 className="owner-settings-heading">Connect Telegram or Discord</h2>
      <p className="owner-settings-note">
        Chat with your agent in Telegram or Discord. Connect here so it links to <em>this</em> dashboard
        account — not a second vault.
      </p>

      <div className="trading-dash-stack-tight">
        <div className="gate-card" style={{ margin: 0 }}>
          <h3 style={{ fontSize: 14, marginBottom: 8 }}>Telegram</h3>
          {!telegram ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || loading === "telegram"}
              onClick={() => void issueCode("telegram")}
            >
              {loading === "telegram" ? "Generating…" : "Get Telegram link"}
            </button>
          ) : (
            <>
              <p className="owner-settings-note">
                Tap the link (expires in {telegram.ttlMinutes} min). Telegram opens with{" "}
                <code>/start {telegram.startParam}</code> — send it if prompted.
              </p>
              {tgLink ? (
                <p className="owner-settings-note">
                  <a href={tgLink} className="text-link" target="_blank" rel="noreferrer">
                    Open Telegram →
                  </a>
                </p>
              ) : null}
              <CopyBlock text={telegram.startParam} label="Copy start code" />
            </>
          )}
        </div>

        <div className="gate-card" style={{ margin: 0 }}>
          <h3 style={{ fontSize: 14, marginBottom: 8 }}>Discord</h3>
          {!discordCode ? (
            <button
              type="button"
              className="btn btn-outline"
              disabled={busy || loading === "discord"}
              onClick={() => void issueCode("discord")}
            >
              {loading === "discord" ? "Generating…" : "Get Discord code"}
            </button>
          ) : (
            <>
              <p className="owner-settings-note">
                In the Rhagent Discord bot, send (expires in {discordCode.ttlMinutes} min):
              </p>
              <CopyBlock text={`/link ${discordCode.startParam}`} label="Copy command" />
            </>
          )}
        </div>
      </div>

      {error ? <p className="owner-settings-note" style={{ color: "var(--danger, #e55)" }}>{error}</p> : null}

      {onConnected ? (
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={onConnected} style={{ marginTop: 12 }}>
          I connected — refresh
        </button>
      ) : null}

      <p className="owner-settings-note muted" style={{ marginTop: 12 }}>
        Already chatting with the bot? Send <code>/website</code> there for a login link instead.
      </p>
    </div>
  );
}
