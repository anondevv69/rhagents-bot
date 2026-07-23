"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function DashboardLoginClient({ code }: { code: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) {
      setError("Missing login code. Send /website in Telegram or Discord for a fresh link.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/dashboard/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || !body.ok) {
          if (!cancelled) setError(body.error || "Login failed.");
          return;
        }
        router.replace("/dashboard?tab=setup");
      } catch {
        if (!cancelled) setError("Network error — try again with /website in Telegram or Discord.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, router]);

  return (
    <div className="gate-inner">
      <div className="gate-card">
        <h1 className="page-header-title">Trading dashboard</h1>
        {error ? (
          <>
            <p className="owner-settings-note">{error}</p>
            <p className="owner-settings-note">
              Send <code>/website</code> in Telegram or Discord to get a new one-time link.
            </p>
          </>
        ) : (
          <p className="owner-settings-note">Signing you in…</p>
        )}
      </div>
    </div>
  );
}
