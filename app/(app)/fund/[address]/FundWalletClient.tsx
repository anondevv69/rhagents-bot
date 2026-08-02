"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Identity = {
  phone: string | null;
  email: string | null;
  phone_verified: boolean;
  email_verified: boolean;
  ready: boolean;
};

type FundConfig = {
  provider: "swapped" | "coinbase" | null;
  swapped_configured: boolean;
  swapped_sandbox: boolean;
  cdp_configured: boolean;
  sandbox: boolean;
};

const SANDBOX_PHONE = "+10005550100";
const SANDBOX_EMAIL = "tester@sandbox.test";
const SANDBOX_CODE = "000000";

const IFRAME_ALLOW =
  "accelerometer; autoplay; camera; encrypted-media; gyroscope; payment; clipboard-read; clipboard-write";

function friendlyError(raw: string): string {
  if (raw === "phone_must_be_e164_us") {
    return "Enter a valid US phone number, e.g. 4155551234 or +14155551234.";
  }
  if (raw === "invalid_email") return "Enter a valid email address.";
  if (raw === "invalid_amount") return "Enter a valid amount (e.g. 25 or 25.00).";
  if (raw === "swapped_not_configured") {
    return "Card deposits aren't configured on the server yet — try again later.";
  }
  if (raw === "otp_provider_not_configured") {
    return "Deposits aren't configured on the server yet — try again later.";
  }
  if (raw.startsWith("coinbase_verification_not_allowlisted")) {
    return "Coinbase Onramp isn't enabled on this API key yet. Use the test values below (code 000000) to try the flow, or enter your real phone/email once Onramp is approved.";
  }
  if (raw.startsWith("coinbase_otp_send_failed") || raw.startsWith("coinbase_otp")) {
    return `Coinbase couldn't send the code (${raw.replace(/^coinbase_otp[a-z_]*: ?/, "")}).`;
  }
  if (raw === "invalid_or_expired_code") {
    return "That code is wrong or expired — request a new one.";
  }
  return raw;
}

function SwappedFundPanel({
  address,
  initialAmount,
  sandbox,
}: {
  address: string;
  initialAmount: string;
  sandbox: boolean;
}) {
  const searchParams = useSearchParams();
  const paidReturn = searchParams.get("paid") === "1";
  const [amount, setAmount] = useState(initialAmount);
  const [widgetUrl, setWidgetUrl] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const apiBase = `/api/fund/${encodeURIComponent(address)}`;

  const loadWidget = useCallback(async () => {
    setError("");
    setLoading(true);
    setStatus("Loading checkout…");
    try {
      const res = await fetch(
        `${apiBase}/widget?amount=${encodeURIComponent(amount.trim())}`,
      );
      const data = await res.json();
      if (!data.ok) {
        setError(friendlyError(data.error ?? "Could not start checkout"));
        setWidgetUrl("");
        setStatus("");
        return;
      }
      setWidgetUrl(data.widgetUrl);
      setStatus("");
    } catch {
      setError("Network error — try again.");
      setStatus("");
    } finally {
      setLoading(false);
    }
  }, [apiBase, amount]);

  useEffect(() => {
    void loadWidget();
  }, [loadWidget]);

  const subtitle = sandbox
    ? "Sandbox — test card only, Sepolia ETH (max €15)"
    : "Card or Apple Pay → USDC on Base";

  return (
    <>
      <p style={{ color: "#666", fontSize: 14, marginTop: 0 }}>{subtitle}</p>
      <p style={{ fontSize: 12, wordBreak: "break-all", color: "#888" }}>{address}</p>

      {paidReturn && (
        <p
          style={{
            marginTop: 12,
            padding: 10,
            background: "#e8f8ee",
            border: "1px solid #9ed4b0",
            borderRadius: 8,
            fontSize: 13,
            color: "#1a5c32",
          }}
        >
          Payment submitted — credits convert automatically when Swapped confirms (~1–2 min).
        </p>
      )}

      {sandbox && (
        <p
          style={{
            marginTop: 12,
            padding: 10,
            background: "#fff8e6",
            border: "1px solid #f0d78c",
            borderRadius: 8,
            fontSize: 13,
            color: "#664d00",
          }}
        >
          Sandbox mode: use Swapped test cards only. Crypto lands as testnet ETH, not USDC on
          Base.
        </p>
      )}

      <label style={{ display: "block", marginTop: 16, fontSize: 14 }}>
        Amount ({sandbox ? "EUR, max 15" : "USD"})
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ display: "block", width: "100%", marginTop: 4, padding: 10, fontSize: 16 }}
        />
      </label>

      <button
        type="button"
        disabled={loading}
        onClick={() => void loadWidget()}
        style={{
          marginTop: 12,
          width: "100%",
          padding: 12,
          fontSize: 15,
          fontWeight: 600,
          background: loading ? "#999" : "#007aff",
          color: "#fff",
          border: "none",
          borderRadius: 10,
        }}
      >
        {loading ? "Loading…" : "Refresh checkout"}
      </button>

      {widgetUrl && (
        <iframe
          src={widgetUrl}
          allow={IFRAME_ALLOW}
          title="Buy crypto with Swapped"
          style={{
            width: "100%",
            maxWidth: 400,
            height: 482,
            margin: "16px auto 0",
            display: "block",
            border: 0,
            borderRadius: 28,
          }}
        />
      )}

      {status && <p style={{ marginTop: 12, fontSize: 14, color: "#333" }}>{status}</p>}
      {error && <p style={{ marginTop: 12, fontSize: 14, color: "#c00" }}>{error}</p>}

      <p style={{ marginTop: 24, fontSize: 12, color: "#888" }}>
        After payment, LLM credits are added automatically. If chat doesn&apos;t work in 2 min,
        run /buy_credits.
      </p>
    </>
  );
}

function CoinbaseFundPanel({
  address,
  initialAmount,
  cdpOk,
  sandbox,
}: {
  address: string;
  initialAmount: string;
  cdpOk: boolean;
  sandbox: boolean;
}) {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [amount, setAmount] = useState(initialAmount);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [phoneChallenge, setPhoneChallenge] = useState("");
  const [emailChallenge, setEmailChallenge] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [paymentLinkUrl, setPaymentLinkUrl] = useState("");

  const apiBase = `/api/fund/${encodeURIComponent(address)}`;

  const refreshIdentity = useCallback(async () => {
    const res = await fetch(apiBase + "/identity");
    const data = await res.json();
    if (data.ok) {
      setIdentity(data.identity);
      if (data.identity?.phone) setPhone(data.identity.phone);
      if (data.identity?.email) setEmail(data.identity.email);
    } else {
      setError(data.error ?? "Could not load wallet");
    }
  }, [apiBase]);

  useEffect(() => {
    void refreshIdentity();
  }, [refreshIdentity]);

  async function sendOtp(channel: "phone" | "email") {
    setError("");
    setStatus(`Sending ${channel} code…`);
    const destination = channel === "phone" ? phone.trim() : email.trim();
    const res = await fetch(`${apiBase}/otp/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, destination }),
    });
    const data = await res.json();
    if (!data.ok) {
      setError(friendlyError(data.error ?? "OTP send failed"));
      setStatus("");
      return;
    }
    if (channel === "phone") setPhoneChallenge(data.challenge_id);
    else setEmailChallenge(data.challenge_id);
    setStatus(
      data.dev_code
        ? `${channel} code sent (dev: ${data.dev_code})`
        : `${channel} code sent — check messages`,
    );
  }

  async function verifyOtp(channel: "phone" | "email") {
    setError("");
    const destination = channel === "phone" ? phone.trim() : email.trim();
    const challengeId = channel === "phone" ? phoneChallenge : emailChallenge;
    const code = channel === "phone" ? phoneCode.trim() : emailCode.trim();
    const res = await fetch(`${apiBase}/otp/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, destination, challenge_id: challengeId, code }),
    });
    const data = await res.json();
    if (!data.ok) {
      setError(friendlyError(data.error ?? "Invalid code"));
      return;
    }
    setIdentity(data.identity);
    setStatus(`${channel} verified`);
  }

  async function startDeposit() {
    setError("");
    setStatus("Creating Apple Pay session…");
    const res = await fetch(`${apiBase}/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payment_amount: amount }),
    });
    const data = await res.json();
    if (!data.ok) {
      setError(friendlyError(data.error ?? "Deposit failed"));
      setStatus("");
      return;
    }
    setPaymentLinkUrl(data.paymentLinkUrl);
    setStatus("Complete payment below");
  }

  const ready = identity?.ready;

  return (
    <>
      <p style={{ color: "#666", fontSize: 14, marginTop: 0 }}>Apple Pay → USDC on Base</p>
      <p style={{ fontSize: 12, wordBreak: "break-all", color: "#888" }}>{address}</p>

      {!cdpOk && (
        <p style={{ color: "#c00", fontSize: 14 }}>Coinbase onramp not configured on server yet.</p>
      )}

      <label style={{ display: "block", marginTop: 16, fontSize: 14 }}>
        Amount (USD)
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ display: "block", width: "100%", marginTop: 4, padding: 10, fontSize: 16 }}
        />
      </label>

      {!ready && (
        <div style={{ marginTop: 20 }}>
          <p style={{ fontSize: 14, fontWeight: 600 }}>Verify once (Coinbase sends the code)</p>
          {cdpOk && (
            <div
              style={{
                marginTop: 8,
                marginBottom: 8,
                padding: 10,
                background: "#f2f7ff",
                border: "1px solid #cfe0ff",
                borderRadius: 8,
                fontSize: 13,
              }}
            >
              <p style={{ margin: 0, color: "#333" }}>
                {sandbox
                  ? `Sandbox mode — no real money moves. Test code: ${SANDBOX_CODE}.`
                  : `Testing without Onramp approval? Use Coinbase test values and code ${SANDBOX_CODE}.`}
              </p>
              <button
                type="button"
                onClick={() => {
                  setPhone(SANDBOX_PHONE);
                  setEmail(SANDBOX_EMAIL);
                  setPhoneCode(SANDBOX_CODE);
                  setEmailCode(SANDBOX_CODE);
                }}
                style={{ marginTop: 6 }}
              >
                Use test values
              </button>
            </div>
          )}
          <label style={{ display: "block", marginTop: 12, fontSize: 14 }}>
            US phone
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="4155551234 or +14155551234"
              style={{ display: "block", width: "100%", marginTop: 4, padding: 10 }}
            />
          </label>
          <button type="button" onClick={() => void sendOtp("phone")} style={{ marginTop: 8 }}>
            Send phone code
          </button>
          {phoneChallenge && (
            <input
              value={phoneCode}
              onChange={(e) => setPhoneCode(e.target.value)}
              placeholder="Phone OTP"
              style={{ display: "block", width: "100%", marginTop: 8, padding: 10 }}
            />
          )}
          {phoneChallenge && (
            <button type="button" onClick={() => void verifyOtp("phone")} style={{ marginTop: 8 }}>
              Verify phone
            </button>
          )}

          <label style={{ display: "block", marginTop: 16, fontSize: 14 }}>
            Email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{ display: "block", width: "100%", marginTop: 4, padding: 10 }}
            />
          </label>
          <button type="button" onClick={() => void sendOtp("email")} style={{ marginTop: 8 }}>
            Send email code
          </button>
          {emailChallenge && (
            <input
              value={emailCode}
              onChange={(e) => setEmailCode(e.target.value)}
              placeholder="Email OTP"
              style={{ display: "block", width: "100%", marginTop: 8, padding: 10 }}
            />
          )}
          {emailChallenge && (
            <button type="button" onClick={() => void verifyOtp("email")} style={{ marginTop: 8 }}>
              Verify email
            </button>
          )}
        </div>
      )}

      {ready && !paymentLinkUrl && (
        <button
          type="button"
          onClick={() => void startDeposit()}
          style={{
            marginTop: 24,
            width: "100%",
            padding: 14,
            fontSize: 16,
            fontWeight: 600,
            background: "#007aff",
            color: "#fff",
            border: "none",
            borderRadius: 10,
          }}
        >
          Pay with Apple Pay
        </button>
      )}

      {paymentLinkUrl && (
        <iframe
          src={paymentLinkUrl}
          allow="payment"
          title="Apple Pay"
          style={{ width: "100%", height: 420, marginTop: 16, border: 0, borderRadius: 12 }}
        />
      )}

      {status && <p style={{ marginTop: 12, fontSize: 14, color: "#333" }}>{status}</p>}
      {error && <p style={{ marginTop: 12, fontSize: 14, color: "#c00" }}>{error}</p>}

      <p style={{ marginTop: 24, fontSize: 12, color: "#888" }}>
        After payment, LLM credits are added automatically. If chat doesn&apos;t work in 2 min,
        run /buy_credits.
      </p>
    </>
  );
}

export default function FundWalletClient({
  address,
  initialAmount,
}: {
  address: string;
  initialAmount: string;
}) {
  const [config, setConfig] = useState<FundConfig | null>(null);
  const [error, setError] = useState("");

  const apiBase = `/api/fund/${encodeURIComponent(address)}`;

  useEffect(() => {
    void (async () => {
      const res = await fetch(apiBase + "/identity");
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Could not load fund page");
        return;
      }
      const swapped = Boolean(data.swapped_configured);
      const cdp = Boolean(data.cdp_configured);
      setConfig({
        provider: swapped ? "swapped" : cdp ? "coinbase" : null,
        swapped_configured: swapped,
        swapped_sandbox: Boolean(data.swapped_sandbox),
        cdp_configured: cdp,
        sandbox: Boolean(data.sandbox),
      });
    })();
  }, [apiBase]);

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px", fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Add funds</h1>

      {!config && !error && (
        <p style={{ color: "#666", fontSize: 14 }}>Loading…</p>
      )}

      {config?.provider === "swapped" && (
        <SwappedFundPanel
          address={address}
          initialAmount={initialAmount}
          sandbox={config.swapped_sandbox}
        />
      )}

      {config?.provider === "coinbase" && (
        <CoinbaseFundPanel
          address={address}
          initialAmount={initialAmount}
          cdpOk={config.cdp_configured}
          sandbox={config.sandbox}
        />
      )}

      {config && !config.provider && (
        <p style={{ color: "#c00", fontSize: 14 }}>
          Card deposits aren&apos;t configured on the server yet.
        </p>
      )}

      {error && <p style={{ marginTop: 12, fontSize: 14, color: "#c00" }}>{error}</p>}
    </div>
  );
}
