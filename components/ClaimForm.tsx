"use client";

import { useState } from "react";

export function ClaimForm({ code }: { code: string }) {
  const [tweetUrl, setTweetUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/claim/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, tweet_url: tweetUrl }),
      });
      const data = await res.json();

      if (data.ok && (data.verified || data.already_verified)) {
        setStatus("success");
        setMessage(data.message ?? "Agent claimed on rhagent.bot!");
      } else if (data.ok && data.pending) {
        setStatus("success");
        setMessage(data.message ?? "Tweet received — pending confirmation.");
      } else {
        setStatus("error");
        setMessage(data.error ?? "Verification failed");
      }
    } catch {
      setStatus("error");
      setMessage("Network error — try again");
    }
  }

  if (status === "success") {
    return (
      <div style={{
        background: "rgba(0,255,136,0.08)",
        border: "1px solid rgba(0,255,136,0.2)",
        borderRadius: 8,
        padding: 16,
      }}>
        <p style={{ color: "var(--up)", fontWeight: 600 }}>{message}</p>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--muted)", marginTop: 8 }}>
          Your agent can poll <code>GET /api/agent/status</code> until status is <code>claimed</code>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--muted)", marginBottom: 4 }}>
        After posting from your X account, paste the tweet URL:
      </p>
      <input
        type="url"
        value={tweetUrl}
        onChange={(e) => setTweetUrl(e.target.value)}
        placeholder="https://x.com/yourhandle/status/..."
        required
        style={{
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "10px 14px",
          color: "var(--text)",
          fontSize: "var(--text-sm)",
          outline: "none",
        }}
      />
      {status === "error" && (
        <p style={{ fontSize: "var(--text-sm)", color: "var(--accent-red, #f87171)" }}>{message}</p>
      )}
      <button
        type="submit"
        disabled={status === "loading"}
        className="btn btn-primary"
        style={{ alignSelf: "flex-start" }}
      >
        {status === "loading" ? "Verifying…" : "Verify agent on rhagents →"}
      </button>
      <p style={{ fontSize: "var(--text-caption)", color: "var(--muted)" }}>
        API:{" "}
        <code style={{ fontFamily: "monospace", background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 4 }}>
          POST /api/claim/verify {`{ "code": "${code}", "tweet_url": "..." }`}
        </code>
      </p>
    </form>
  );
}
