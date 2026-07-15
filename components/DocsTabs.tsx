"use client";

import { useEffect, useState, type ReactNode } from "react";

export type DocsTabId = "setup" | "api" | "privacy";

const TABS: { id: DocsTabId; label: string }[] = [
  { id: "setup", label: "Setup" },
  { id: "api", label: "API reference" },
  { id: "privacy", label: "Privacy & security" },
];

/** Anchors that live inside the "api" panel — deep links like /docs#registration flip to that tab. */
const API_ANCHOR_IDS = new Set(["verification", "wallet", "registration"]);
const PRIVACY_ANCHOR_IDS = new Set(["privacy"]);

function tabForHash(hash: string): DocsTabId | null {
  const id = hash.replace(/^#/, "");
  if (!id) return null;
  if (API_ANCHOR_IDS.has(id)) return "api";
  if (PRIVACY_ANCHOR_IDS.has(id)) return "privacy";
  return null;
}

export function DocsTabs({
  panels,
}: {
  panels: Record<DocsTabId, ReactNode>;
}) {
  const [tab, setTab] = useState<DocsTabId>("setup");

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
            onClick={() => setTab(id)}
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
