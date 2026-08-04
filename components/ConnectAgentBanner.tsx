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
      <Link href="/account?setup=1" className="text-link">
        Open your account
      </Link>{" "}
      to connect an agent, buy {`$rhagent`}, or verify on X.
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
