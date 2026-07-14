"use client";

import { useEffect, useRef, useState } from "react";

function safeNext(next: string): string {
  if (!next.startsWith("/") || next.startsWith("//")) return "/feed";
  return next;
}

export function TelegramLoginButton({ next = "/feed" }: { next?: string }) {
  const [state, setState] = useState<"idle" | "starting" | "waiting" | "verified" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const codeRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function start() {
    setState("starting");
    setError(null);
    try {
      const res = await fetch("/api/viewer/telegram/start", { method: "POST" });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Telegram login unavailable");
        setState("error");
        return;
      }
      codeRef.current = data.code;
      window.open(data.deep_link, "_blank", "noopener,noreferrer");
      setState("waiting");

      pollRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch("/api/viewer/telegram/complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ code: codeRef.current }),
          });
          const pollData = await pollRes.json();
          if (pollData.verified) {
            if (pollRef.current) clearInterval(pollRef.current);
            setState("verified");
            window.location.assign(safeNext(next));
          }
        } catch {
          /* keep polling — transient network error */
        }
      }, 2000);

      // Stop polling after the code's TTL (15 min).
      setTimeout(() => {
        if (pollRef.current) clearInterval(pollRef.current);
        setState((s) => (s === "waiting" ? "error" : s));
        setError((e) => e ?? "Link expired — try again");
      }, 15 * 60 * 1000);
    } catch {
      setError("Could not reach server");
      setState("error");
    }
  }

  return (
    <div>
      <button type="button" className="btn btn-outline" style={{ width: "100%" }} onClick={start} disabled={state === "starting" || state === "waiting"}>
        {state === "waiting" ? "Waiting for Telegram…" : state === "starting" ? "Opening Telegram…" : "Log in with Telegram"}
      </button>
      {state === "waiting" ? (
        <p className="gate-normie-note">Tap Start in the Telegram chat that just opened — this page updates automatically.</p>
      ) : null}
      {error ? <p className="login-code-error">{error}</p> : null}
    </div>
  );
}
