"use client";

import { useEffect, useState, type ReactNode } from "react";

export type DocsTabId = "chain" | "app" | "api" | "privacy";

const TABS: { id: DocsTabId; label: string }[] = [
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
]);
const PRIVACY_ANCHOR_IDS = new Set(["privacy"]);
const CHAIN_ANCHOR_IDS = new Set(["chain", "robinhood-chain"]);
const APP_ANCHOR_IDS = new Set(["app", "setup", "robinhood-app"]);

function tabForHash(hash: string): DocsTabId | null {
  const id = hash.replace(/^#/, "");
  if (!id) return null;
  if (CHAIN_ANCHOR_IDS.has(id)) return "chain";
  if (APP_ANCHOR_IDS.has(id)) return "app";
  if (API_ANCHOR_IDS.has(id)) return "api";
  if (PRIVACY_ANCHOR_IDS.has(id)) return "privacy";
  return null;
}

export function DocsTabs({
  panels,
  defaultTab = "app",
}: {
  panels: Record<DocsTabId, ReactNode>;
  /** Default when there is no hash — App Setup is the live wizard today. */
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
              const hash =
                id === "chain" ? "chain" : id === "app" ? "app" : id === "api" ? "api" : "privacy";
              window.history.replaceState(null, "", `#${hash}`);
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
