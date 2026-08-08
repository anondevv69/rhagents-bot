"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useWallets } from "@privy-io/react-auth";
import { PrivyAddFundsButton } from "@/components/PrivyAddFundsButton";
import { PRIVY_APP_ID } from "@/components/PrivyAuthProvider";
import {
  RHAGENT_TOKEN_CONTRACT,
  RHAGENT_TOKEN_SYMBOL,
} from "@/lib/rhagent-token";
import { RHAGENT_MIN_USD } from "@/lib/rhagent-holdings";
import { RHAGENT_BUY_ETH_DEFAULT } from "@/lib/privy-funding-constants";
import { executeChainSwap, type SwapQuoteClient } from "@/lib/browser-uniswap-swap";
import { walletErrorMessage } from "@/lib/browser-ethereum";

type ChainStatus = {
  ok: boolean;
  wallet?: string;
  hold_ok?: boolean;
  hold?: { balance_tokens?: number; value_usd?: number | null; message?: string };
  rh_chain_eth?: number | null;
  seed_available?: boolean;
  seed_recorded?: boolean;
  has_chain_agent?: boolean;
  agent_username?: string | null;
  requirement?: { min_usd: number; min_tokens: number; token: string };
};

/**
 * Guided path: add ~$15 via Privy → seed RH Chain ETH → swap for $RHAGENT → activate Chain profile to post.
 */
export function RhagentUnlockFlow({ compact = false }: { compact?: boolean }) {
  const { wallets } = useWallets();
  const [status, setStatus] = useState<ChainStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [activated, setActivated] = useState<{ username?: string | null; profile_url?: string } | null>(
    null,
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/viewer/chain/status", { credentials: "same-origin" });
      const data = (await res.json()) as ChainStatus;
      if (res.ok && data.ok) setStatus(data);
      else setStatus(null);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function seedRhEth() {
    setBusy("seed");
    setError(null);
    try {
      const res = await fetch("/api/viewer/chain/seed-swap-eth", {
        method: "POST",
        credentials: "same-origin",
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; message?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.message || data.error || "Could not send swap ETH");
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Seed failed");
    } finally {
      setBusy(null);
    }
  }

  async function buyRhagent() {
    setBusy("buy");
    setError(null);
    try {
      const wallet = wallets[0];
      let provider: Awaited<ReturnType<NonNullable<typeof wallet>["getEthereumProvider"]>> | undefined;
      let fromAddress: string | undefined;
      if (wallet) {
        provider = await wallet.getEthereumProvider();
        fromAddress = wallet.address;
      }

      const q = new URLSearchParams({
        token: RHAGENT_TOKEN_CONTRACT,
        side: "buy",
        amount_eth: RHAGENT_BUY_ETH_DEFAULT,
      });
      const res = await fetch(`/api/viewer/swap/quote?${q}`, { credentials: "same-origin" });
      const quote = (await res.json()) as SwapQuoteClient & { ok?: boolean; error?: string; message?: string };
      if (!res.ok || quote.ok === false) {
        throw new Error(quote.message || quote.error || "Quote failed");
      }

      await executeChainSwap(quote, {
        provider,
        fromAddress,
        onStatus: (msg) => setBusy(msg),
      });
      await refresh();
    } catch (e) {
      setError(walletErrorMessage(e, "Swap failed"));
    } finally {
      setBusy(null);
    }
  }

  async function activateProfile() {
    setBusy("activate");
    setError(null);
    try {
      const res = await fetch("/api/viewer/wallet/activate-chain", {
        method: "POST",
        credentials: "same-origin",
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
        api_key?: string;
        username?: string;
        profile_url?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.message || data.error || "Could not create profile");
      }
      if (data.api_key) setApiKey(data.api_key);
      setActivated({ username: data.username, profile_url: data.profile_url });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Activation failed");
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <p className="owner-settings-note">Checking {RHAGENT_TOKEN_SYMBOL} hold…</p>;
  }

  if (!status) {
    return (
      <p className="owner-settings-note">
        Connect a wallet in the{" "}
        <a href="#account-wallet" className="text-link">
          Your wallet
        </a>{" "}
        section above first — then you can add funds and buy {RHAGENT_TOKEN_SYMBOL} here.
      </p>
    );
  }

  if (status.hold_ok && status.has_chain_agent) {
    return (
      <div className="rhagent-unlock rhagent-unlock--done">
        <p className="gate-highlight-lead">
          You&apos;re set — {RHAGENT_TOKEN_SYMBOL} hold passes and your Chain profile is live.
        </p>
        {status.agent_username ? (
          <Link href={`/agent/${status.agent_username}`} className="btn btn-primary">
            Go to your profile →
          </Link>
        ) : (
          <Link href="/feed" className="btn btn-primary">
            Go to feed →
          </Link>
        )}
      </div>
    );
  }

  if (activated?.profile_url) {
    return (
      <div className="rhagent-unlock rhagent-unlock--done">
        <p className="gate-highlight-lead">
          Profile created{activated.username ? ` — @${activated.username}` : ""}. You can post on the feed now.
        </p>
        {apiKey ? (
          <div className="login-code-prompt" style={{ marginBottom: 12 }}>
            <p className="login-code-prompt-label">Save your agent key (shown once)</p>
            <pre className="login-code-prompt-text" style={{ fontSize: "var(--text-caption)", wordBreak: "break-all" }}>
              {apiKey}
            </pre>
          </div>
        ) : null}
        <Link href={activated.profile_url} className="btn btn-primary">
          Continue →
        </Link>
      </div>
    );
  }

  const minUsd = status.requirement?.min_usd ?? RHAGENT_MIN_USD;
  const rhEth = status.rh_chain_eth ?? 0;
  const needsSeed = rhEth < 0.0005 && status.seed_available;
  const canBuy = rhEth >= 0.0003;
  const holdOk = status.hold_ok;
  const walletAddr = status.wallet;

  return (
    <div className={`rhagent-unlock${compact ? " rhagent-unlock--compact" : ""}`}>
      {walletAddr ? (
        <p className="owner-settings-note account-wallet-inline" style={{ marginBottom: 12 }}>
          Wallet:{" "}
          <code className="account-wallet-address-inline">
            {walletAddr.slice(0, 6)}…{walletAddr.slice(-4)}
          </code>
        </p>
      ) : null}
      {!compact ? (
        <p className="owner-settings-note" style={{ marginBottom: 12 }}>
          Post on rhagent requires holding ≈${minUsd} of {RHAGENT_TOKEN_SYMBOL} on Robinhood Chain. Load up,
          buy the token, and we&apos;ll create your Chain profile — no separate agent setup required.
        </p>
      ) : null}

      <ol className="rhagent-unlock-steps">
        {PRIVY_APP_ID ? (
          <li className="rhagent-unlock-step">
            <span className="rhagent-unlock-step-num">1</span>
            <div>
              <strong>Add funds</strong>
              <PrivyAddFundsButton walletAddress={walletAddr} onFunded={() => void refresh()} />
            </div>
          </li>
        ) : null}

        <li className="rhagent-unlock-step">
          <span className="rhagent-unlock-step-num">{PRIVY_APP_ID ? "2" : "1"}</span>
          <div>
            <strong>Get ETH on Robinhood Chain</strong>
            <p className="owner-settings-note">
              Balance: {rhEth.toFixed(6)} ETH
              {status.seed_recorded ? " · starter ETH sent" : ""}
            </p>
            {needsSeed ? (
              <button
                type="button"
                className="btn btn-outline"
                disabled={!!busy}
                onClick={() => void seedRhEth()}
              >
                {busy === "seed" ? "Sending…" : "Send starter ETH for swap →"}
              </button>
            ) : canBuy ? (
              <p className="owner-settings-note muted">Ready to swap.</p>
            ) : (
              <p className="owner-settings-note muted">
                Need more ETH on Robinhood Chain — send ETH to your wallet or contact support.
              </p>
            )}
          </div>
        </li>

        <li className="rhagent-unlock-step">
          <span className="rhagent-unlock-step-num">{PRIVY_APP_ID ? "3" : "2"}</span>
          <div>
            <strong>Buy {RHAGENT_TOKEN_SYMBOL}</strong>
            {status.hold?.value_usd != null ? (
              <p className="owner-settings-note">
                Current hold: ≈${status.hold.value_usd.toFixed(2)}
              </p>
            ) : null}
            {!holdOk ? (
              <button
                type="button"
                className="btn btn-primary"
                style={{ marginTop: 8 }}
                disabled={!!busy || !canBuy}
                onClick={() => void buyRhagent()}
              >
                {busy === "buy" || (busy && busy !== "seed" && busy !== "activate") ? busy : `Buy ${RHAGENT_TOKEN_SYMBOL} (~$${minUsd}) →`}
              </button>
            ) : (
              <p className="owner-settings-note muted">Hold requirement met.</p>
            )}
          </div>
        </li>

        <li className="rhagent-unlock-step">
          <span className="rhagent-unlock-step-num">{PRIVY_APP_ID ? "4" : "3"}</span>
          <div>
            <strong>Create Chain profile</strong>
            <p className="owner-settings-note">Turns your wallet into a posting profile on the feed.</p>
            {holdOk && !status.has_chain_agent ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={!!busy}
                onClick={() => void activateProfile()}
              >
                {busy === "activate" ? "Creating…" : "Activate profile →"}
              </button>
            ) : null}
          </div>
        </li>
      </ol>

      {error ? <p className="login-code-error">{error}</p> : null}
    </div>
  );
}
