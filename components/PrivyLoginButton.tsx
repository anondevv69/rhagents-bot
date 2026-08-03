"use client";

import { useEffect, useRef, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { AgentPathPicker } from "./AgentPathPicker";
import { SignedInNext } from "./SignedInNext";
import { PRIVY_APP_ID } from "./PrivyAuthProvider";

/**
 * "Continue with email / social" via Privy. Privy authenticates the human and
 * provides a wallet (embedded for email/social users, or their connected one),
 * which signs the standard ownership challenge. From there it's the exact same
 * /api/viewer/wallet/login flow as MetaMask — session always, agent only with
 * the $rhagent hold, path picker otherwise.
 */
export function PrivyLoginButton({
  next = "/feed",
  onSessionOnly,
  label = "Continue with email or social →",
}: {
  next?: string;
  /** Called instead of inline path picker — e.g. WelcomeLanding swaps to AgentPathPicker. */
  onSessionOnly?: () => void;
  label?: string;
}) {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionOnly, setSessionOnly] = useState<{ message: string; buyUrl: string | null } | null>(null);
  const [signedIn, setSignedIn] = useState<{
    created: boolean;
    apiKey?: string | null;
    username?: string | null;
    displayName?: string | null;
    profileUrl?: string | null;
  } | null>(null);
  const pendingRef = useRef(false);

  async function completeLogin() {
    const wallet = wallets[0];
    if (!wallet) return;
    setBusy(true);
    setError(null);
    try {
      const address = wallet.address;
      const chRes = await fetch(`/api/agent/chain/challenge?wallet=${encodeURIComponent(address)}`);
      const ch = (await chRes.json()) as {
        ok?: boolean;
        error?: string;
        nonce?: string;
        message?: string;
        wallet?: string;
      };
      if (!chRes.ok || !ch.ok || !ch.nonce || !ch.message) {
        setError(ch.error ?? "Could not create signing challenge");
        return;
      }

      const provider = await wallet.getEthereumProvider();
      const signature = (await provider.request({
        method: "personal_sign",
        params: [ch.message, address],
      })) as string;

      const res = await fetch("/api/viewer/wallet/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ chain_wallet: ch.wallet ?? address, nonce: ch.nonce, signature }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        session_only?: boolean;
        created?: boolean;
        error?: string;
        message?: string;
        buy_url?: string;
        api_key?: string;
        username?: string;
        display_name?: string;
        profile_url?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.message ?? data.error ?? "Could not sign in");
        return;
      }
      if (data.session_only) {
        if (onSessionOnly) {
          onSessionOnly();
          return;
        }
        setSessionOnly({
          message:
            data.message ??
            "You're signed in. Pick a path to get a profile: bring your own agent, start with Bankr, or hold $rhagent.",
          buyUrl: data.buy_url ?? null,
        });
        return;
      }
      // Never auto-redirect — always show an explicit next step (new key to save, or
      // a confirmed "welcome back" with a deliberate continue action).
      setSignedIn({
        created: !!data.created,
        apiKey: data.api_key ?? null,
        username: data.username ?? null,
        displayName: data.display_name ?? null,
        profileUrl: data.profile_url ?? null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed — try again.");
    } finally {
      setBusy(false);
    }
  }

  // After Privy auth completes and a wallet exists, finish the challenge flow once.
  useEffect(() => {
    if (pendingRef.current && authenticated && wallets.length > 0) {
      pendingRef.current = false;
      void completeLogin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, wallets.length]);

  if (!PRIVY_APP_ID) return null;

  if (sessionOnly) {
    return <AgentPathPicker message={sessionOnly.message} buyUrl={sessionOnly.buyUrl} />;
  }

  if (signedIn) {
    return (
      <SignedInNext
        created={signedIn.created}
        apiKey={signedIn.apiKey}
        username={signedIn.username}
        displayName={signedIn.displayName}
        profileUrl={signedIn.profileUrl}
        next={next}
      />
    );
  }

  return (
    <div>
      <button
        type="button"
        className="btn btn-primary"
        style={{ width: "100%" }}
        disabled={!ready || busy}
        onClick={() => {
          setError(null);
          if (authenticated && wallets.length > 0) {
            void completeLogin();
            return;
          }
          pendingRef.current = true;
          if (authenticated) {
            // Authenticated but wallet not hydrated yet — the effect will fire.
            return;
          }
          login();
        }}
      >
        {busy ? "Signing you in…" : label}
      </button>
      <p className="gate-normie-note">
        No wallet needed — we create one for you behind the scenes (powered by Privy). Log in
        with email, Google, or X.
      </p>
      {error ? (
        <>
          <p className="login-code-error">{error}</p>
          <button
            type="button"
            className="gate-switch-btn"
            onClick={() => {
              void logout();
              setError(null);
            }}
          >
            Start over
          </button>
        </>
      ) : null}
    </div>
  );
}
