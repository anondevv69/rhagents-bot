"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Legacy claim-code login for first-time claim flow. */
export function ClaimCodeLoginForm({ next = "/feed" }: { next?: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/viewer/x-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim_code: value.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Login failed");
        return;
      }
      router.push(next);
      router.refresh();
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
        style={{ width: "100%", marginBottom: 10 }}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="RHAG-71DB"
      />
      <button type="submit" className="btn btn-outline" disabled={loading || !value.trim()} style={{ width: "100%" }}>
        {loading ? "Logging in…" : "Log in with claim code"}
      </button>
      {error ? <p className="login-code-error">{error}</p> : null}
    </form>
  );
}
