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

/**
 * Opens Privy's fiat onramp — card / Apple Pay → USDC on Base in the user's embedded wallet.
 * Enable funding in the Privy dashboard (Account Funding → Stripe / MoonPay).
 */
export function PrivyAddFundsButton({
  label,
  walletAddress,
  onFunded,
}: {
  label?: string;
  /** Show which address receives funds (Privy embedded wallet). */
  walletAddress?: string | null;
  onFunded?: () => void;
}) {
  const { ready, authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const { addFunds } = useAddFunds();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const defaultFiat = useMemo(() => defaultPrivyFiatAsset(), []);
  const buttonLabel = label ?? privyFundLabel(PRIVY_FUND_DEFAULT_AMOUNT, defaultFiat);

  if (!PRIVY_APP_ID) return null;

  async function onClick() {
    setError(null);
    if (!authenticated) {
      login();
      return;
    }
    const wallet = wallets[0];
    if (!wallet?.address) {
      setError("Wallet not ready yet — wait a moment and try again.");
      return;
    }
    setBusy(true);
    try {
      const fiat: PrivyFiatAsset = defaultPrivyFiatAsset();
      await addFunds({
        destination: {
          address: wallet.address,
          chain: BASE_CAIP2,
          asset: BASE_USDC,
        },
        fiat: {
          source: {
            assets: [...PRIVY_FIAT_ASSETS],
            defaultAsset: fiat,
          },
          environment: "production",
          defaultAmount: PRIVY_FUND_DEFAULT_AMOUNT,
        },
      });
      setDone(true);
      onFunded?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/cancel|exit|closed/i.test(msg)) {
        if (/region|not currently supported|coming soon/i.test(msg)) {
          setError(
            "Card deposits aren't available in your region yet via MoonPay/Stripe. Try another currency in the payment modal, or send crypto to your wallet address above.",
          );
        } else {
          setError(msg || "Funding did not complete — try again.");
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {walletAddress ? (
        <p className="owner-settings-note" style={{ marginBottom: 8 }}>
          Deposits go to{" "}
          <code className="account-wallet-address-inline">
            {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
          </code>{" "}
          (USDC on Base via Privy · pays in {defaultFiat.toUpperCase()} where supported).
        </p>
      ) : null}
      <button
        type="button"
        className="btn btn-primary"
        style={{ width: "100%" }}
        disabled={!ready || busy}
        onClick={() => void onClick()}
      >
        {busy ? "Opening payment…" : done ? "Add more funds →" : buttonLabel}
      </button>
      <p className="gate-normie-note">
        Card or Apple Pay via Privy (MoonPay / Stripe). Currency follows your locale (e.g. EUR in
        France) — not a country code. USDC lands on Base; we send starter ETH on Robinhood Chain for
        the {`$rhagent`} swap.
      </p>
      {error ? <p className="login-code-error">{error}</p> : null}
    </div>
  );
}
