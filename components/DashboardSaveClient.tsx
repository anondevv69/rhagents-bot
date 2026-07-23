"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function DashboardSaveClient({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [needsMerge, setNeedsMerge] = useState(false);
  const [busy, setBusy] = useState(false);

  async function claim(force = false) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, force }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        needsMerge?: boolean;
      };
      if (!res.ok || !body.ok) {
        if (body.needsMerge) {
          setNeedsMerge(true);
          setError(body.error ?? "Account conflict.");
          return;
        }
        setError(body.error || "Save failed.");
        return;
      }
      router.replace("/dashboard?tab=setup&saved=1");
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!token) {
      setError("Missing save link. Send /start in Telegram or Discord for a fresh link.");
      return;
    }
    void claim(false);
  }, [token]);

  return (
    <div className="gate-inner">
      <div className="gate-card">
        <h1 className="page-header-title">Save your agent</h1>
        {needsMerge ? (
          <>
            <p className="owner-settings-note">{error}</p>
            <p className="owner-settings-note">
              Continuing will log you into the Telegram/Discord account from this link instead of your current
              dashboard session. Declining leaves both accounts unchanged — this link stays valid until you use it or
              it expires.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void claim(true)}>
                {busy ? "Saving…" : "Continue — use bot account"}
              </button>
              <Link href="/dashboard?tab=setup" className="btn btn-outline">
                No — keep current account
              </Link>
            </div>
          </>
        ) : error ? (
          <p className="owner-settings-note">{error}</p>
        ) : (
          <p className="owner-settings-note">Linking your chat account to this browser…</p>
        )}
      </div>
    </div>
  );
}
