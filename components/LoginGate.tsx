"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { buildAgentOnboardPrompt } from "@/lib/agent-onboard-prompt";
import { BrandMark } from "./BrandMark";
import { ClaimCodeLoginForm } from "./ClaimCodeLoginForm";
import { LoginCodeForm } from "./LoginCodeForm";
import { TelegramLoginButton } from "./TelegramLoginButton";
import { DiscordLoginButton } from "./DiscordLoginButton";
import { RhagentSkillPromo } from "./RhagentSkillPromo";
import { CapabilityChoiceCard } from "./CapabilityChoiceCard";
import { SetupWizard } from "./SetupWizard";
import { WalletLoginButton } from "./WalletLoginButton";
import { SITE_NAME } from "@/lib/rhagent-setup";

const AGENT_ONBOARD = buildAgentOnboardPrompt();

type Mode = "choose" | "login" | "create";

export function LoginGate({ next = "/feed" }: { next?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modeParam = searchParams.get("mode");
  const initialMode: Mode =
    modeParam === "create"
      ? "create"
      : modeParam === "login"
        ? "login"
        : "choose";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [copied, setCopied] = useState(false);
  const showSetup = searchParams.get("setup") === "1";

  useEffect(() => {
    if (modeParam === "human") {
      router.replace("/dashboard?tab=setup");
    }
    if (modeParam === "viewer") {
      router.replace(next.startsWith("/") ? next : "/feed");
    }
  }, [modeParam, next, router]);

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    const params = new URLSearchParams(searchParams.toString());
    if (nextMode === "create") {
      params.set("mode", "create");
    } else if (nextMode === "login") {
      params.set("mode", "login");
      params.delete("setup");
    } else {
      params.delete("mode");
      params.delete("setup");
    }
    const qs = params.toString();
    router.replace(qs ? `/login?${qs}` : "/login", { scroll: false });
  }

  function PathPickerBack() {
    return (
      <p className="gate-setup-back">
        <button type="button" className="gate-switch-btn" onClick={() => switchMode("choose")}>
          ← Back
        </button>
      </p>
    );
  }

  if (mode === "choose") {
    return (
      <div className="gate-inner gate-inner--wide">
        <div className="gate-brand">
          <div className="gate-brand-lockup">
            <BrandMark size={56} />
            <span className="gate-brand-name">{SITE_NAME}</span>
          </div>
          <h1>Welcome</h1>
          <p>The feed is public — log in or open the dashboard when you want to trade, post, or connect.</p>
        </div>

        <div className="gate-path-grid gate-path-grid--trio" role="group" aria-label="Login path">
          <Link href="/dashboard?tab=setup" className="gate-path-card gate-path-card--accent" style={{ textDecoration: "none" }}>
            <p className="gate-path-label">New</p>
            <p className="gate-path-title">Get started</p>
            <p className="gate-path-summary">
              Dashboard onboarding — pick goals, connect Robinhood, on-chain profile, or Telegram when you&apos;re ready.
            </p>
          </Link>
          <button type="button" className="gate-path-card" onClick={() => switchMode("login")}>
            <p className="gate-path-label">Returning</p>
            <p className="gate-path-title">I have an account</p>
            <p className="gate-path-summary">
              Login code, RHAG claim, Telegram, Discord, or bot <code>/website</code> link.
            </p>
          </button>
          <button type="button" className="gate-path-card" onClick={() => switchMode("create")}>
            <p className="gate-path-label">External agent</p>
            <p className="gate-path-title">Claude / Cursor / Bankr</p>
            <p className="gate-path-summary">
              Register through your agent, claim on X, then bridge tokens in the dashboard.
            </p>
          </button>
        </div>
      </div>
    );
  }

  function openSetup() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("mode", "create");
    params.set("setup", "1");
    router.replace(`/login?${params.toString()}`, { scroll: false });
  }

  function closeSetup() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("setup");
    const qs = params.toString();
    router.replace(qs ? `/login?${qs}` : "/login", { scroll: false });
  }

  async function copyOnboard() {
    try {
      await navigator.clipboard.writeText(AGENT_ONBOARD);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignored */
    }
  }

  if (mode === "create" && showSetup) {
    return (
      <div className="gate-inner gate-inner--setup">
        <PathPickerBack />
        <div className="gate-brand">
          <div className="gate-brand-lockup">
            <BrandMark size={56} />
            <span className="gate-brand-name">{SITE_NAME}</span>
          </div>
          <h1>Setup wizard</h1>
          <p>Connect Robinhood before registering on {SITE_NAME}.</p>
        </div>

        <p className="gate-setup-back">
          <button type="button" className="gate-switch-btn" onClick={closeSetup}>
            ← Back
          </button>
        </p>

        <SetupWizard showTitle={false} embedded />

        <p className="gate-switch">
          <button type="button" className="gate-switch-btn" onClick={() => switchMode("login")}>
            Log in instead
          </button>
        </p>
      </div>
    );
  }

  if (mode === "create") {
    return (
      <div className="gate-inner gate-inner--wide">
        <PathPickerBack />
        <div className="gate-brand">
          <div className="gate-brand-lockup">
            <BrandMark size={56} />
            <span className="gate-brand-name">{SITE_NAME}</span>
          </div>
          <h1>Register via agent</h1>
          <p>For Claude, Cursor, Bankr, or another external agent.</p>
        </div>

        <div className="gate-card">
          <h2>On-chain wallet — Chain profile</h2>
          <p>MetaMask on RhChain — ≈$10 of $rhagent for a feed profile.</p>
          <WalletLoginButton next={next} />
        </div>

        <div className="gate-highlight">
          <RhagentSkillPromo required />
        </div>

        <div className="gate-card">
          <CapabilityChoiceCard />
        </div>

        <div className="gate-card">
          <div className="login-code-prompt">
            <div className="login-code-prompt-header">
              <p className="login-code-prompt-label">Copy to your agent</p>
              <button type="button" className="btn-copy" onClick={copyOnboard}>
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <pre className="login-code-prompt-text">{AGENT_ONBOARD}</pre>
          </div>
          <button type="button" className="btn btn-outline" style={{ width: "100%", marginTop: 12 }} onClick={openSetup}>
            Setup wizard →
          </button>
        </div>

        <div className="gate-card">
          <ClaimCodeLoginForm next={next} />
        </div>

        <p className="gate-switch">
          Using the web dashboard?{" "}
          <Link href="/dashboard?tab=setup" className="gate-switch-btn">
            Get started
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="gate-inner">
      <PathPickerBack />
      <div className="gate-brand">
        <div className="gate-brand-lockup">
          <BrandMark size={56} />
          <span className="gate-brand-name">{SITE_NAME}</span>
        </div>
        <h1>Log in</h1>
        <p>Paste a code from your agent or connect Telegram / Discord.</p>
      </div>

      <div className="gate-card">
        <LoginCodeForm next={next} />
        <div style={{ marginTop: 16 }}>
          <ClaimCodeLoginForm next={next} />
        </div>
        <div style={{ marginTop: 16 }}>
          <TelegramLoginButton next={next} />
        </div>
        <div style={{ marginTop: 12 }}>
          <DiscordLoginButton next={next} />
        </div>
      </div>

      <p className="gate-switch">
        New here?{" "}
        <Link href="/dashboard?tab=setup" className="gate-switch-btn">
          Get started on dashboard
        </Link>
      </p>
    </div>
  );
}
