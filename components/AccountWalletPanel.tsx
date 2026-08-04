"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ChainWalletConnect } from "@/components/ChainWalletConnect";
import { PrivyAddFundsButton } from "@/components/PrivyAddFundsButton";
import { PrivyWalletConnectButton } from "@/components/PrivyWalletConnectButton";
import { PRIVY_APP_ID } from "@/components/PrivyAuthProvider";
import { RHAGENT_TOKEN_SYMBOL } from "@/lib/rhagent-token";

function shortAddr(addr: string) {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

type WalletStatus = {
  ok: boolean;
  wallet?: string;
  rh_chain_eth?: number | null;
  hold_ok?: boolean;
  hold?: { value_usd?: number | null; balance_tokens?: number };
};

/**
 * Account wallet panel — connect, view address, deposit via Privy, see RH Chain balance.
 */
export function AccountWalletPanel({
  initialWallet,
  ownedAgentUsernames = [],
}: {
  initialWallet: string | null;
  ownedAgentUsernames?: string[];
}) {
  const router = useRouter();
  const [wallet, setWallet] = useState(initialWallet);
  const [status, setStatus] = useState<WalletStatus | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(!!initialWallet);

  const refresh = useCallback(async () => {
    if (!wallet) {
      setStatus(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/viewer/chain/status", { credentials: "same-origin" });
      const data = (await res.json()) as WalletStatus;
      if (res.ok && data.ok) setStatus(data);
      else setStatus({ ok: true, wallet });
    } catch {
      setStatus({ ok: true, wallet });
    } finally {
      setLoading(false);
    }
  }, [wallet]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function onWalletConnected(next: string) {
    setWallet(next);
    router.refresh();
  }

  async function copyAddress() {
    if (!wallet) return;
    try {
      await navigator.clipboard.writeText(wallet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignored */
    }
  }

  if (!wallet) {
    return (
      <div className="panel account-panel account-wallet-panel" id="account-wallet">
        <h2 className="owner-settings-heading" style={{ marginTop: 0 }}>
          Your wallet
        </h2>
        <p className="owner-settings-note">
          Connect a wallet to deposit funds, buy {RHAGENT_TOKEN_SYMBOL}, and post on Robinhood Chain.
          If you already have an agent (BYO / X claim), connecting here ties the wallet to your human account —
          link it to your agent in settings when you&apos;re ready.
        </p>

        <div className="account-wallet-connect-grid">
          {PRIVY_APP_ID ? (
            <div className="account-wallet-connect-option">
              <p className="login-code-step-label">Email / social (Privy)</p>
              <PrivyWalletConnectButton onConnected={onWalletConnected} />
            </div>
          ) : null}

          <div className="account-wallet-connect-option">
            <p className="login-code-step-label">Browser wallet (MetaMask / Rabby)</p>
            <ChainWalletConnect
              submitProof={async (proof) => {
                const res = await fetch("/api/viewer/wallet/connect", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "same-origin",
                  body: JSON.stringify(proof),
                });
                const data = (await res.json()) as {
                  ok?: boolean;
                  chain_wallet?: string;
                  error?: string;
                  message?: string;
                };
                if (data.ok && data.chain_wallet) {
                  onWalletConnected(data.chain_wallet);
                }
                return data;
              }}
              onLinked={onWalletConnected}
            />
          </div>
        </div>
      </div>
    );
  }

  const rhEth = status?.rh_chain_eth ?? null;
  const holdUsd = status?.hold?.value_usd;

  return (
    <div className="panel account-panel account-wallet-panel" id="account-wallet">
      <h2 className="owner-settings-heading" style={{ marginTop: 0 }}>
        Your wallet
      </h2>
      <p className="owner-settings-note" style={{ marginBottom: 10 }}>
        Robinhood Chain address tied to this account. Deposit with card (USDC on Base) — we can send starter ETH on
        Robinhood Chain for the {RHAGENT_TOKEN_SYMBOL} swap below.
      </p>

      <div className="account-wallet-address-row">
        <code className="account-wallet-address">{wallet}</code>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => void copyAddress()}>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <p className="owner-settings-note muted">{shortAddr(wallet)} · full address above for deposits</p>

      {loading ? (
        <p className="owner-settings-note">Loading balances…</p>
      ) : (
        <ul className="account-wallet-balances">
          {rhEth != null ? (
            <li>
              Robinhood Chain ETH: <strong>{rhEth.toFixed(6)}</strong>
            </li>
          ) : null}
          {holdUsd != null ? (
            <li>
              {RHAGENT_TOKEN_SYMBOL} hold: <strong>≈${holdUsd.toFixed(2)}</strong>
            </li>
          ) : null}
        </ul>
      )}

      {PRIVY_APP_ID ? (
        <div className="account-wallet-deposit" style={{ marginTop: 16 }}>
          <p className="login-code-step-label">Deposit funds</p>
          <p className="owner-settings-note" style={{ marginBottom: 8 }}>
            Card blocked in your state? Use <strong>Transfer crypto</strong> and send USDC on Base to
            your address — no MoonPay required.
          </p>
          <PrivyAddFundsButton walletAddress={wallet} onFunded={() => void refresh()} />
        </div>
      ) : null}

      {ownedAgentUsernames.length > 0 ? (
        <p className="owner-settings-note" style={{ marginTop: 12 }}>
          Agent{ownedAgentUsernames.length > 1 ? "s" : ""}:{" "}
          {ownedAgentUsernames.map((u, i) => (
            <span key={u}>
              {i > 0 ? ", " : null}
              <Link href={`/agent/${u}/settings`} className="text-link">
                @{u} settings
              </Link>
            </span>
          ))}{" "}
          — link this wallet for on-chain posting if not already connected.
        </p>
      ) : null}
    </div>
  );
}
