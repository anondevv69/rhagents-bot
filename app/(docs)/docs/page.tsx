"use client";

import { useEffect } from "react";

const LEGACY_HASH: Record<string, string> = {
  setup: "/docs/start-here",
  start: "/docs/start-here",
  guide: "/docs/feed",
  api: "/docs/api",
  "external-mcp": "/docs/setup/byo-agent",
  telegram: "/docs/setup/hosted-bot",
  discord: "/docs/setup/hosted-bot",
  "bankr-credits": "/docs/reference#bankr-club-vs-credits",
  "bankr-automations": "/docs/reference#automations",
  chain: "/docs/reference#robinhood-chain",
  "chain-hold-rules": "/docs/reference#robinhood-chain",
  privacy: "/docs/reference#privacy--custody",
  "account-types": "/docs/start-here#account-tiers",
};

export default function DocsIndexPage() {
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "").trim();
    const target = hash ? LEGACY_HASH[hash] : null;
    window.location.replace(target ?? "/docs/start-here");
  }, []);
  return (
    <p className="docs-body" style={{ padding: "2rem", textAlign: "center" }}>
      Redirecting to documentation…
    </p>
  );
}
