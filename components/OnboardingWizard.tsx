"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import {
  ONBOARD_USER_TYPES,
  dashboardGoalUrl,
  type OnboardUserType,
} from "@/lib/onboarding-wizard";
import type { OnboardingGoal } from "@/lib/dashboard-onboarding-goals";

const STEPS = ["path", "wallet", "connect", "done"] as const;
type StepId = (typeof STEPS)[number];

async function dashboardApi(path: string, options: RequestInit = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "dashboard",
      ...(options.headers || {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    message?: string;
    evmAddress?: string;
    connections?: { bankrWallet?: string | null; bankr?: boolean };
  };
  if (!res.ok || body.ok === false) {
    throw new Error(body.error || body.message || `Request failed (${res.status})`);
  }
  return body;
}

type Props = {
  telegramUrl?: string | null;
  discordUrl?: string | null;
  starterCreditUsd?: number;
  starterMessages?: number;
};

export function OnboardingWizard({
  telegramUrl,
  discordUrl,
  starterCreditUsd = 5,
  starterMessages = 10,
}: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [userType, setUserType] = useState<OnboardUserType | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [pickedGoal, setPickedGoal] = useState<OnboardingGoal | null>(null);

  const step = STEPS[stepIndex];
  const typeOption = useMemo(
    () => ONBOARD_USER_TYPES.find((t) => t.id === userType) ?? null,
    [userType],
  );

  const ensureSession = useCallback(async () => {
    try {
      await dashboardApi("/api/dashboard/proxy/settings/me");
      return true;
    } catch {
      const res = await fetch("/api/dashboard/account/create", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Could not create your account.");
      }
      return true;
    }
  }, []);

  const provisionWallet = useCallback(async (): Promise<string | null> => {
    setBusy(true);
    setError(null);
    try {
      await ensureSession();
      try {
        await dashboardApi("/api/dashboard/proxy/setup/bootstrap", { method: "POST" });
      } catch {
        /* non-fatal */
      }
      const me = (await dashboardApi("/api/dashboard/proxy/settings/me")) as {
        connections?: { bankrWallet?: string | null; bankr?: boolean };
      };
      const existing = me.connections?.bankrWallet?.trim();
      if (existing) {
        setWalletAddress(existing);
        return existing;
      }
      const created = await dashboardApi("/api/dashboard/proxy/setup/wallet", { method: "POST" });
      const addr = created.evmAddress?.trim();
      if (!addr) throw new Error("Wallet created but no address returned.");
      setWalletAddress(addr);
      return addr;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet setup failed.");
      return null;
    } finally {
      setBusy(false);
    }
  }, [ensureSession]);

  const saveGoalPreference = useCallback(async (goal: OnboardingGoal, surface: string) => {
    try {
      await ensureSession();
      if (surface !== "unset") {
        await dashboardApi("/api/dashboard/proxy/dashboard/ui-preference", {
          method: "PATCH",
          body: JSON.stringify({ ui_default_surface: surface }),
        });
      }
      setPickedGoal(goal);
    } catch {
      /* preference is optional — wizard still works */
      setPickedGoal(goal);
    }
  }, [ensureSession]);

  async function onContinue() {
    setError(null);
    if (step === "path") {
      if (!typeOption) return;
      await saveGoalPreference(typeOption.goal, typeOption.surface);
      setStepIndex(1);
      return;
    }
    if (step === "wallet") {
      if (!walletAddress) {
        const addr = await provisionWallet();
        if (addr) setStepIndex(2);
        return;
      }
      setStepIndex(2);
      return;
    }
    if (step === "connect") {
      setStepIndex(3);
    }
  }

  const goal = pickedGoal ?? typeOption?.goal ?? "bot";
  const shortAddr = walletAddress
    ? `${walletAddress.slice(0, 8)}…${walletAddress.slice(-6)}`
    : null;

  return (
    <div className="gate-inner gate-inner--wide">
      <div className="gate-card onboarding-wizard">
        <div className="onboarding-wizard-progress" aria-hidden>
          {STEPS.map((id, i) => (
            <span key={id} className={`onboarding-wizard-progress-seg${i <= stepIndex ? " is-active" : ""}`} />
          ))}
        </div>

        {step === "path" ? (
          <>
            <h1 className="page-header-title">How will you use rhagent?</h1>
            <p className="owner-settings-note muted">Pick a path — you can add the rest anytime on the dashboard.</p>
            <div className="trading-dash-welcome-grid" style={{ marginTop: 20 }}>
              {ONBOARD_USER_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`trading-dash-welcome-card${userType === t.id ? " is-selected" : ""}`}
                  onClick={() => setUserType(t.id)}
                >
                  <strong>{t.title}</strong>
                  <span className="owner-settings-note muted">{t.summary}</span>
                </button>
              ))}
            </div>
          </>
        ) : null}

        {step === "wallet" ? (
          <>
            <h1 className="page-header-title">Wallet setup</h1>
            <p className="owner-settings-note muted">
              We auto-provision a Bankr wallet on Robinhood Chain — same as Telegram / Discord /start.
            </p>
            {busy ? (
              <p className="owner-settings-note" style={{ marginTop: 24 }}>
                Provisioning your wallet…
              </p>
            ) : walletAddress ? (
              <ul className="onboarding-wizard-checklist">
                <li>Wallet created</li>
                {starterCreditUsd > 0 ? <li>${starterCreditUsd} starter LLM credit (loads in ~30s)</li> : null}
                <li>{starterMessages} free bot chat messages</li>
                <li className="mono muted">{shortAddr}</li>
              </ul>
            ) : (
              <ul className="owner-settings-note muted" style={{ marginTop: 16, paddingLeft: 18 }}>
                <li>EVM wallet on Robinhood Chain &amp; Base</li>
                {starterCreditUsd > 0 ? <li>${starterCreditUsd} LLM credits for Bankr agent chat</li> : null}
                <li>{starterMessages} free messages before you need your own LLM key</li>
              </ul>
            )}
          </>
        ) : null}

        {step === "connect" ? (
          <>
            <h1 className="page-header-title">Connect accounts</h1>
            <p className="owner-settings-note muted">Optional now — finish whenever you&apos;re ready to trade.</p>
            <div className="onboarding-wizard-connect-list">
              <ConnectRow
                title="Robinhood Crypto"
                desc="Spot crypto — API keypair + rh-api-…"
                recommended={userType === "trader" || userType === "copier"}
                href={dashboardGoalUrl("rh_crypto")}
              />
              <ConnectRow
                title="Robinhood Agentic"
                desc="Stocks & options — desktop OAuth or MCP token"
                recommended={userType === "trader" || userType === "agent"}
                href={dashboardGoalUrl("rh_agentic")}
              />
              <ConnectRow
                title="rhagent.bot feed"
                desc="Post fills & copy trades"
                recommended={userType === "copier"}
                href={dashboardGoalUrl("feed")}
              />
              <ConnectRow
                title="Telegram / Discord"
                desc="Mobile bot, skills, jobs, cron"
                recommended={userType === "agent" || userType === "partner"}
                href={dashboardGoalUrl("bot")}
              />
            </div>
          </>
        ) : null}

        {step === "done" ? (
          <>
            <h1 className="page-header-title">You&apos;re set up</h1>
            <p className="owner-settings-note muted">Same account everywhere — chat, dashboard, and feed stay in sync.</p>
            <div className="onboarding-wizard-done-actions">
              {telegramUrl ? (
                <a href={telegramUrl} className="btn btn-primary" target="_blank" rel="noreferrer">
                  Open Telegram
                </a>
              ) : null}
              {discordUrl ? (
                <a href={discordUrl} className="btn btn-secondary" target="_blank" rel="noreferrer">
                  Add Discord bot
                </a>
              ) : null}
              <Link href={dashboardGoalUrl(goal)} className="btn btn-secondary">
                Open dashboard
              </Link>
            </div>
          </>
        ) : null}

        {error ? (
          <p className="owner-settings-note" style={{ color: "var(--danger, #f87171)", marginTop: 16 }}>
            {error}
          </p>
        ) : null}

        {step !== "done" ? (
          <div className="onboarding-wizard-nav">
            {stepIndex > 0 ? (
              <button type="button" className="btn btn-outline" disabled={busy} onClick={() => setStepIndex((i) => i - 1)}>
                Back
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || (step === "path" && !userType)}
              onClick={() => void onContinue()}
            >
              {step === "wallet" && !walletAddress ? "Create wallet" : "Continue"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ConnectRow({
  title,
  desc,
  recommended,
  href,
}: {
  title: string;
  desc: string;
  recommended?: boolean;
  href: string;
}) {
  return (
    <div className="onboarding-wizard-connect-row">
      <div>
        <strong>
          {title}
          {recommended ? <span className="badge badge-success onboarding-wizard-badge">Recommended</span> : null}
        </strong>
        <p className="owner-settings-note muted">{desc}</p>
      </div>
      <Link href={href} className="btn btn-outline btn-sm">
        Connect
      </Link>
    </div>
  );
}
