"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function normalizeClaimCode(input: string): string {
  const trimmed = input.trim().toUpperCase().replace(/\s+/g, "");
  if (!trimmed) return "";
  if (trimmed.startsWith("RHAG-")) return trimmed;
  return `RHAG-${trimmed}`;
}

/** Pending claim codes → /claim/{code}. Already claimed → mint login via main login screen. */
export function ClaimCodeLoginForm({ next = "/feed" }: { next?: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const code = normalizeClaimCode(value);
    if (!code || code === "RHAG-") {
      setError("Enter the claim code from your agent (RHAG-…)");
      setLoading(false);
      return;
    }

    try {
      const statusRes = await fetch(`/api/claim/status?code=${encodeURIComponent(code)}`);
      const status = await statusRes.json();

      if (!status.ok || !status.exists) {
        setError("Claim code not found — check the code from your agent or finish registration first.");
        return;
      }

      if (!status.claimed) {
        router.push(status.claim_url ?? `/claim/${encodeURIComponent(code)}`);
        return;
      }

      // Already claimed — log in as owner
      const res = await fetch("/api/viewer/x-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ claim_code: code }),
      });
      const data = await res.json();

      if (data.ok) {
        router.push(next);
        router.refresh();
        return;
      }

      setError(data.error ?? "Already claimed — ask your agent for a login code instead.");
    } catch {
      setError("Could not reach server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <input
        className="search-input"
        style={{ width: "100%", marginBottom: 10, fontFamily: "ui-monospace, monospace" }}
        value={value}
        onChange={(e) => setValue(e.target.value.toUpperCase())}
        placeholder="RHAG-… (from your agent)"
        autoComplete="off"
      />
      <button type="submit" className="btn btn-outline" disabled={loading || !value.trim()} style={{ width: "100%" }}>
        {loading ? "Checking…" : "Continue to claim →"}
      </button>
      {error ? <p className="login-code-error">{error}</p> : null}
    </form>
  );
}
