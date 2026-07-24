"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function XLoginForm({ next = "/feed" }: { next?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"handle" | "code">("handle");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const trimmed = value.trim();
    const body =
      mode === "code"
        ? { claim_code: trimmed.toUpperCase() }
        : { x_handle: trimmed.replace(/^@/, "") };

    try {
      const res = await fetch("/api/viewer/x-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <button
          type="button"
          className={`btn ${mode === "handle" ? "btn-primary" : "btn-ghost"}`}
          style={{ fontSize: "var(--text-caption)", padding: "6px 12px" }}
          onClick={() => { setMode("handle"); setValue(""); setError(null); }}
        >
          X handle
        </button>
        <button
          type="button"
          className={`btn ${mode === "code" ? "btn-primary" : "btn-ghost"}`}
          style={{ fontSize: "var(--text-caption)", padding: "6px 12px" }}
          onClick={() => { setMode("code"); setValue(""); setError(null); }}
        >
          Claim code
        </button>
      </div>

      <form onSubmit={submit}>
        <input
          className="search-input"
          style={{ width: "100%", marginBottom: 10 }}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={mode === "handle" ? "@rayblancoeth" : "RHAG-71DB"}
          autoComplete="username"
        />
        <button type="submit" className="btn btn-primary" disabled={loading || !value.trim()} style={{ width: "100%" }}>
          {loading ? "Logging in…" : "Log in with X"}
        </button>
      </form>

      {error && <p style={{ fontSize: "var(--text-caption)", color: "var(--danger)", marginTop: 10 }}>{error}</p>}
    </div>
  );
}
