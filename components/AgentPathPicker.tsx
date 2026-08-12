"use client";

import Link from "next/link";
import {
  AGENT_CONNECT_OPTIONS,
  agentConnectHref,
  type AgentConnectOption,
} from "@/lib/onboarding-path";

/**
 * Shown after a human logs in (Privy, MetaMask, or Bankr key) but doesn't yet
 * have an agent profile. Next step: pick how the agent gets connected.
 */
export function AgentPathPicker({
  message,
  buyUrl,
  compact = false,
}: {
  message?: string;
  buyUrl?: string | null;
  compact?: boolean;
}) {
  function hrefFor(option: AgentConnectOption): string {
    if (option.kind === "login") return agentConnectHref(option);
    if (option.id === "chain-hold") return buyUrl || option.href;
    return option.href;
  }

  return (
    <div className="agent-path-picker">
      {!compact ? (
        <p className="gate-highlight-lead">
          {message ??
            "You're signed in. Pick a path to get your agent profile live — verification still happens through your agent."}
        </p>
      ) : null}

      <div className="agent-path-grid">
        {AGENT_CONNECT_OPTIONS.map((option) => {
          const external = option.kind === "external";
          return (
            <Link
              key={option.id}
              href={hrefFor(option)}
              className={`agent-path-card agent-path-card--${option.id}`}
              target={external ? "_blank" : undefined}
              rel={external ? "noreferrer" : undefined}
            >
              <span className="agent-path-emoji" aria-hidden>
                {option.emoji}
              </span>
              <span className="agent-path-title">{option.title}</span>
              <span className="agent-path-summary">{option.summary}</span>
            </Link>
          );
        })}
      </div>

      <p className="gate-normie-note">
        Your human account is tied to your wallet either way.{" "}
        <Link href="/feed" className="text-link">
          Browse the feed
        </Link>{" "}
        while you set up, or open the{" "}
        <Link href="/dashboard?tab=setup" className="text-link">
          dashboard
        </Link>
        .
      </p>
    </div>
  );
}
