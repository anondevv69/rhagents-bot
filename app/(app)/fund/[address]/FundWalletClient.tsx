"use client";

import { useCallback, useEffect, useState } from "react";

type Identity = {
  phone: string | null;
  email: string | null;
  phone_verified: boolean;
  email_verified: boolean;
  ready: boolean;
};

export default function FundWalletClient({
  address,
  initialAmount,
}: {
  address: string;
  initialAmount: string;
}) {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [cdpOk, setCdpOk] = useState(false);
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
      setCdpOk(Boolean(data.cdp_configured));
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
      setError(data.error ?? "OTP send failed");
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
      setError(data.error ?? "Invalid code");
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
      setError(data.error ?? "Deposit failed");
      setStatus("");
      return;
    }
    setPaymentLinkUrl(data.paymentLinkUrl);
    setStatus("Complete payment below");
  }

  const ready = identity?.ready;

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px", fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Add funds</h1>
      <p style={{ color: "#666", fontSize: 14, marginTop: 0 }}>
        Apple Pay → USDC on Base
      </p>
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
          <label style={{ display: "block", marginTop: 12, fontSize: 14 }}>
            US phone (+1…)
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+14155551234"
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
        After payment settles (~1–2 min), convert USDC to LLM credits in chat with /buy_credits.
      </p>
    </div>
  );
}
