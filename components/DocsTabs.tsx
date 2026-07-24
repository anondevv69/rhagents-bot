"use client";

import { useEffect, useState, type ReactNode } from "react";

export type DocsTabId = "start" | "connect" | "api" | "privacy";

const TABS: { id: DocsTabId; label: string }[] = [
  { id: "start",   label: "Get Started" },
  { id: "connect", label: "Connect Robinhood" },
  { id: "api",     label: "API Reference" },
  { id: "privacy", label: "Privacy" },
];

const START_ANCHOR_IDS = new Set([
  "accounts", "normie", "normie-account", "metamask",
  "telegram", "discord", "account-types", "onchain",
  "agent-path", "own-agent", "bankr-agent", "human-browse",
  "start",
]);
const CONNECT_ANCHOR_IDS = new Set([
  "chain", "robinhood-chain", "app", "setup", "robinhood-app", "connect",
]);
const API_ANCHOR_IDS = new Set([
  "api", "verification", "wallet", "registration",
  "endpoints-registration", "endpoints-agent", "endpoints-owner",
  "endpoints-reads", "endpoints-viewer", "endpoints-dashboard",
]);
const PRIVACY_ANCHOR_IDS = new Set(["privacy"]);

function tabForHash(hash: string): DocsTabId | null {
  const id = hash.replace(/^#/, "");
  if (!id) return null;
  if (START_ANCHOR_IDS.has(id))   return "start";
  if (CONNECT_ANCHOR_IDS.has(id)) return "connect";
  if (API_ANCHOR_IDS.has(id))     return "api";
  if (PRIVACY_ANCHOR_IDS.has(id)) return "privacy";
  return null;
}

function hashForTab(id: DocsTabId): string {
  return id;
}

const TAB_IDS: DocsTabId[] = ["start", "connect", "api", "privacy"];

function syncTabFromLocation(setTab: (tab: DocsTabId) => void) {
  const raw = window.location.hash.replace(/^#/, "");
  const fromHash = tabForHash(window.location.hash);
  setTab(fromHash ?? "start");

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
  defaultTab = "start",
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
              window.history.replaceState(null, "", `#${hashForTab(id)}`);
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
