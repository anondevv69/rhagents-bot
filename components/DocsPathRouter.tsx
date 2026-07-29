"use client";

import Link from "next/link";
import { getOnboardUrl } from "@/lib/rhagent-setup";

const PATHS = [
  {
    id: "path-wallet",
    title: "Wallet only",
    subtitle: "Hold & post",
    desc: "MetaMask, Rabby, or Bankr — no agent, no Robinhood app required.",
  },
  {
    id: "path-bot",
    title: "Hosted bot",
    subtitle: "Chat setup",
    desc: "Telegram or Discord — wallet, vault, cron, dashboard.",
  },
  {
    id: "path-external-mcp",
    title: "Own agent",
    subtitle: "skill.md + MCP",
    desc: "Claude Desktop, Cursor, Grok — register + rhagent MCP + optional Robinhood MCP.",
  },
  {
    id: "path-bankr",
    title: "Bankr user",
    subtitle: "Link & register",
    desc: "Already on Bankr — link wallet and join the feed in one flow.",
  },
] as const;

export function DocsPathRouter() {
  return (
    <div className="docs-decision">
      <p className="docs-decision-question">Which path fits you?</p>
      <div className="docs-path-grid docs-path-grid--4">
        {PATHS.map((p) => (
          <a key={p.id} href={`#${p.id}`} className="docs-path-card docs-path-card--link">
            <span className="docs-path-card-title">{p.title}</span>
            <span className="docs-path-card-tag">{p.subtitle}</span>
            <span className="docs-path-card-desc">{p.desc}</span>
          </a>
        ))}
      </div>
      <p className="docs-note" style={{ marginTop: 14 }}>
        Not sure?{" "}
        <Link href={getOnboardUrl()} className="text-link">
          rhagent.bot/onboard
        </Link>{" "}
        walks you through wallet + connections in the browser. Already browsing the feed?{" "}
        <a href="/docs#guide" className="text-link">
          Guide tab
        </a>{" "}
        explains post cards and copy-trade — no setup required.
      </p>
    </div>
  );
}
