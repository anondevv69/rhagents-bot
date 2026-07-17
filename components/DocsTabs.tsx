"use client";

import { useEffect, useState, type ReactNode } from "react";

export type DocsTabId = "accounts" | "chain" | "app" | "api" | "privacy";

const TABS: { id: DocsTabId; label: string }[] = [
  { id: "accounts", label: "Accounts & Setup" },
  { id: "chain", label: "Robinhood Chain Setup" },
  { id: "app", label: "Robinhood App Setup" },
  { id: "api", label: "API Reference" },
  { id: "privacy", label: "Privacy and security" },
];

/** Anchors that live inside the "api" panel — deep links like /docs#registration flip to that tab. */
const API_ANCHOR_IDS = new Set([
  "verification",
  "wallet",
  "registration",
  "endpoints-registration",
  "endpoints-agent",
  "endpoints-owner",
  "endpoints-reads",
  "endpoints-viewer",
  "endpoints-dashboard",
  "api",
]);
const PRIVACY_ANCHOR_IDS = new Set(["privacy"]);
const CHAIN_ANCHOR_IDS = new Set(["chain", "robinhood-chain"]);
const APP_ANCHOR_IDS = new Set(["app", "setup", "robinhood-app"]);
const ACCOUNTS_ANCHOR_IDS = new Set([
  "accounts",
  "normie",
  "normie-account",
  "telegram",
  "discord",
  "metamask",
  "account-types",
]);

function tabForHash(hash: string): DocsTabId | null {
  const id = hash.replace(/^#/, "");
  if (!id) return null;
  if (ACCOUNTS_ANCHOR_IDS.has(id)) return "accounts";
  if (CHAIN_ANCHOR_IDS.has(id)) return "chain";
  if (APP_ANCHOR_IDS.has(id)) return "app";
  if (API_ANCHOR_IDS.has(id)) return "api";
  if (PRIVACY_ANCHOR_IDS.has(id)) return "privacy";
  return null;
}

function hashForTab(id: DocsTabId): string {
  if (id === "accounts") return "accounts";
  if (id === "chain") return "chain";
  if (id === "app") return "app";
  if (id === "api") return "api";
  return "privacy";
}

export function DocsTabs({
  panels,
  defaultTab = "accounts",
}: {
  panels: Record<DocsTabId, ReactNode>;
  /** Default when there is no hash — Accounts & Setup is the human onboarding entry. */
  defaultTab?: DocsTabId;
}) {
  const [tab, setTab] = useState<DocsTabId>(defaultTab);

  useEffect(() => {
    const fromHash = tabForHash(window.location.hash);
    if (fromHash) {
      setTab(fromHash);
      requestAnimationFrame(() => {
        const el = document.getElementById(window.location.hash.slice(1));
        el?.scrollIntoView({ block: "start" });
      });
    }
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
