"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const DISMISS_KEY = "rhagent_connect_agent_banner_dismissed";

/**
 * Persistent nudge for humans who signed in (Privy / wallet / Bankr key) but never
 * finished connecting an agent — without this, the path picker vanishes the moment
 * they leave /login and nothing ever guides them back.
 */
export function ConnectAgentBanner({ show }: { show: boolean }) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (!show || dismissed) return null;

  return (
    <div className="guest-browse-banner connect-agent-banner" role="status">
      You&apos;re signed in — finish setup to get your profile live.{" "}
      <Link href="/login?mode=create" className="text-link">
        Bring your agent
      </Link>{" "}
      or{" "}
      <Link href="/login?mode=bankr" className="text-link">
        start with Bankr
      </Link>
      .
      <button
        type="button"
        className="connect-agent-banner-dismiss"
        aria-label="Dismiss"
        onClick={() => {
          setDismissed(true);
          try {
            sessionStorage.setItem(DISMISS_KEY, "1");
          } catch {
            /* ignored */
          }
        }}
      >
        ×
      </button>
    </div>
  );
}
