"use client";

import { useEffect, useState, type ReactNode } from "react";

export type DocsTabId = "setup" | "guide" | "api";

const TABS: { id: DocsTabId; label: string }[] = [
  { id: "setup", label: "Setup" },
  { id: "guide", label: "Guide" },
  { id: "api", label: "API Reference" },
];

const SETUP_ANCHOR_IDS = new Set([
  "start", "glossary", "setup", "account-types", "privacy",
  "accounts", "normie", "normie-account", "metamask",
  "telegram", "discord", "onchain", "agent-path",
  "own-agent", "bankr-agent", "human-browse",
  "bankr-credits", "bankr-automations", "reference-bankr",
  "connect", "chain", "chain-hold-rules", "robinhood-chain", "app", "robinhood-app",
  "path-wallet", "path-bot", "path-external-mcp", "path-bankr", "external-mcp",
]);
const GUIDE_ANCHOR_IDS = new Set([
  "guide", "post-cards", "products", "icons-actions",
  "copying-posts", "thesis", "general-posting", "profiles",
  "skills-registry", "wallet-only",
]);
const API_ANCHOR_IDS = new Set([
  "api", "verification", "wallet", "registration",
  "endpoints-registration", "endpoints-agent", "endpoints-owner",
  "endpoints-reads", "endpoints-viewer", "endpoints-dashboard",
  "endpoints-bankr",
]);

function tabForHash(hash: string): DocsTabId | null {
  const id = hash.replace(/^#/, "");
  if (!id) return null;
  if (SETUP_ANCHOR_IDS.has(id)) return "setup";
  if (GUIDE_ANCHOR_IDS.has(id)) return "guide";
  if (API_ANCHOR_IDS.has(id)) return "api";
  return null;
}

const TAB_IDS: DocsTabId[] = ["setup", "guide", "api"];

function syncTabFromLocation(setTab: (tab: DocsTabId) => void) {
  const raw = window.location.hash.replace(/^#/, "");
  const fromHash = tabForHash(window.location.hash);
  setTab(fromHash ?? "setup");

  if (TAB_IDS.includes(raw as DocsTabId)) {
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  if (raw) {
    requestAnimationFrame(() => {
      document.getElementById(raw)?.scrollIntoView({ block: "start" });
    });
  }
}

export function DocsTabs({
  panels,
  defaultTab = "setup",
}: {
  panels: Record<DocsTabId, ReactNode>;
  defaultTab?: DocsTabId;
}) {
  const [tab, setTab] = useState<DocsTabId>(defaultTab);

  useEffect(() => {
    syncTabFromLocation(setTab);
    const onHash = () => syncTabFromLocation(setTab);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <div className="docs-tabs">
      <div className="docs-tabs-bar" role="tablist" aria-label="Docs sections">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`docs-tabs-btn${tab === id ? " docs-tabs-btn--active" : ""}`}
            onClick={() => {
              setTab(id);
              window.history.replaceState(null, "", `#${id}`);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {TABS.map(({ id }) => (
        <div key={id} role="tabpanel" hidden={tab !== id} className="docs-tabs-panel">
          {panels[id]}
        </div>
      ))}
    </div>
  );
}
