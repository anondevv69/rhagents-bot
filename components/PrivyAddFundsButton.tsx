"use client";

import { useMemo, useState } from "react";
import { useAddFunds } from "@privy-io/react-auth";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import {
  BASE_CAIP2,
  BASE_USDC,
  PRIVY_FIAT_ASSETS,
  PRIVY_FUND_DEFAULT_AMOUNT,
  defaultPrivyFiatAsset,
  privyFundLabel,
  type PrivyFiatAsset,
} from "@/lib/privy-funding-constants";
import { PRIVY_APP_ID } from "@/components/PrivyAuthProvider";

function regionFundingHint(): string | null {
  if (typeof navigator === "undefined") return null;
  const lang = navigator.language?.toLowerCase() ?? "";
  if (lang.endsWith("-us") || lang === "en-us") {
    return "MoonPay blocks card buys in some US states (e.g. NY, HI, LA, RI, TX). Use Transfer crypto below, or ask us to enable Stripe in Privy.";
  }
  return "If card fails with a region error, use Transfer crypto — send USDC on Base from Coinbase or another wallet.";
}

/**
 * Card onramp (Privy → Stripe / MoonPay / Coinbase) + crypto transfer fallback.
 * MoonPay often fails by US state — crypto deposit bypasses that entirely.
 */
export function PrivyAddFundsButton({
  label,
  walletAddress,
  destinationAddress,
  amountUsd,
  note,
  onFunded,
}: {
  label?: string;
  walletAddress?: string | null;
  /** Override deposit target — e.g. a managed Bankr wallet instead of the Privy embedded wallet. */
  destinationAddress?: string | null;
  amountUsd?: number;
  note?: string | null;
  onFunded?: () => void;
}) {
  const { ready, authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const { addFunds } = useAddFunds();
  const [busy, setBusy] = useState<"card" | "crypto" | "both" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);

  const defaultFiat = useMemo(() => defaultPrivyFiatAsset(), []);
  const fundAmount = amountUsd != null ? String(amountUsd) : PRIVY_FUND_DEFAULT_AMOUNT;
  const cardLabel = label ?? privyFundLabel(fundAmount, defaultFiat);
  const regionHint = useMemo(() => regionFundingHint(), []);

  if (!PRIVY_APP_ID) return null;

  async function resolveDestination(): Promise<string | null> {
    if (destinationAddress) return destinationAddress;
    if (!authenticated) {
      login();
      return null;
    }
    const wallet = wallets[0];
    if (!wallet?.address) {
      setError("Wallet not ready yet — wait a moment and try again.");
      return null;
    }
    return wallet.address;
  }

  async function fund(mode: "card" | "crypto" | "both") {
    setError(null);
    const address = await resolveDestination();
    if (!address) return;

    setBusy(mode);
    try {
      const fiat: PrivyFiatAsset = defaultPrivyFiatAsset();
      const destination = {
        address,
        chain: BASE_CAIP2,
        asset: BASE_USDC,
      };

      if (mode === "crypto") {
        await addFunds({
          destination,
          crypto: { slippageBps: 100 },
        });
      } else if (mode === "card") {
        await addFunds({
          destination,
          fiat: {
            source: {
              assets: [...PRIVY_FIAT_ASSETS],
              defaultAsset: fiat,
            },
            environment: "production",
            defaultAmount: fundAmount,
          },
        });
      } else {
        await addFunds({
          destination,
          fiat: {
            source: {
              assets: [...PRIVY_FIAT_ASSETS],
              defaultAsset: fiat,
            },
            environment: "production",
            defaultAmount: fundAmount,
          },
          crypto: { slippageBps: 100 },
        });
      }

      setDone(true);
      onFunded?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/cancel|exit|closed/i.test(msg)) {
        if (/region|not currently supported|coming soon/i.test(msg)) {
          setError(
            "Card onramp blocked in your region (often MoonPay state rules). Tap Transfer crypto instead, or send USDC on Base to your wallet address below.",
          );
        } else {
          setError(msg || "Funding did not complete — try again.");
        }
      }
    } finally {
      setBusy(null);
    }
  }

  async function copyAddress() {
    const addr = destinationAddress ?? walletAddress ?? wallets[0]?.address;
    if (!addr) return;
    try {
      await navigator.clipboard.writeText(addr);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignored */
    }
  }

  const displayAddress = destinationAddress ?? walletAddress ?? wallets[0]?.address ?? null;

  return (
    <div className="wallet-funding-actions">
      {displayAddress ? (
        <div className="account-wallet-address-row" style={{ marginBottom: 10 }}>
          <code className="account-wallet-address">{displayAddress}</code>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void copyAddress()}>
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      ) : null}

      <div className="wallet-funding-buttons">
        <button
          type="button"
          className="btn btn-primary"
          style={{ flex: 1 }}
          disabled={!ready || !!busy}
          onClick={() => void fund("both")}
        >
          {busy === "both" ? "Opening…" : done ? "Add more funds →" : "Add funds (card or crypto) →"}
        </button>
        <button
          type="button"
          className="btn btn-outline"
          style={{ flex: 1 }}
          disabled={!ready || !!busy}
          onClick={() => void fund("card")}
        >
          {busy === "card" ? "Opening…" : cardLabel}
        </button>
        <button
          type="button"
          className="btn btn-outline"
          style={{ flex: 1 }}
          disabled={!ready || !!busy}
          onClick={() => void fund("crypto")}
        >
          {busy === "crypto" ? "Opening…" : "Transfer crypto →"}
        </button>
      </div>

      <p className="gate-normie-note">
        {note ?? (
          <>
            <strong>Card</strong> — Privy routes to Stripe, MoonPay, or Coinbase (depends on your
            Privy dashboard). USDC lands on <strong>Base</strong>.{" "}
            <strong>Transfer crypto</strong> — send from Coinbase, MetaMask, etc. when card is
            blocked. We then send starter ETH on Robinhood Chain for the {`$RHAGENT`} swap.
          </>
        )}
      </p>

      {regionHint ? (
        <p className="owner-settings-note wallet-funding-region-hint">{regionHint}</p>
      ) : null}

      {error ? <p className="login-code-error">{error}</p> : null}
    </div>
  );
}
