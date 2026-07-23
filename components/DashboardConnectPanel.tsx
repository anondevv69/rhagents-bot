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
  embedded = false,
}: {
  platformLinked?: boolean;
  busy?: boolean;
  onConnected?: () => void;
  /** Inside Setup section — no outer panel wrapper */
  embedded?: boolean;
}) {
  const [telegram, setTelegram] = useState<ConnectPayload | null>(null);
  const [discordCode, setDiscordCode] = useState<ConnectPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const issueCode = useCallback(async (platform: "telegram" | "discord") => {
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
  }, []);

  if (platformLinked) {
    return (
      <p className="owner-settings-note muted">
        Telegram or Discord connected — chat and dashboard share one account.
      </p>
    );
  }

  const tgLink =
    telegram?.deepLinkTelegram ?? (telegram?.startParam ? tradingTelegramDeepLink(telegram.startParam) : null);

  const inner = (
    <>
      {!embedded ? (
        <>
          <h2 className="owner-settings-heading">Connect Telegram or Discord</h2>
          <p className="owner-settings-note">
            Chat with your agent in Telegram or Discord. Connect here so it links to <em>this</em> dashboard account
            — not a second vault.
          </p>
        </>
      ) : null}

      <div className="trading-dash-connect-grid">
        <div className="trading-dash-connect-card">
          <h3 className="trading-dash-connect-card-title">Telegram</h3>
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
              <p className="owner-settings-note muted">
                Expires in {telegram.ttlMinutes} min — tap the link or send{" "}
                <code className="docs-code-inline">/start {telegram.startParam}</code>
              </p>
              {tgLink ? (
                <a href={tgLink} className="btn btn-outline" target="_blank" rel="noreferrer">
                  Open Telegram
                </a>
              ) : null}
              <CopyBlock text={telegram.startParam} label="Copy start code" />
            </>
          )}
        </div>

        <div className="trading-dash-connect-card">
          <h3 className="trading-dash-connect-card-title">Discord</h3>
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
              <p className="owner-settings-note muted">In the Rhagent Discord bot (expires in {discordCode.ttlMinutes} min):</p>
              <CopyBlock text={`/link ${discordCode.startParam}`} label="Copy command" />
            </>
          )}
        </div>
      </div>

      {error ? <p className="owner-settings-note trading-dash-error">{error}</p> : null}

      {onConnected ? (
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={onConnected} style={{ marginTop: 12 }}>
          I connected — refresh
        </button>
      ) : null}

      <p className="owner-settings-note muted" style={{ marginTop: 8 }}>
        Already chatting with the bot? Send <code className="docs-code-inline">/website</code> there for a login link.
      </p>
    </>
  );

  if (embedded) return <div className="trading-dash-connect-embedded">{inner}</div>;
  return <div className="panel trading-dash-connect">{inner}</div>;
}
