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
import { NORMIE_BROWSE_LABEL } from "@/lib/normie-copy";
import { NormieBrowseButton } from "./NormieBrowseButton";
import { WalletLoginButton } from "./WalletLoginButton";
import { SITE_NAME } from "@/lib/rhagent-setup";

const AGENT_ONBOARD = buildAgentOnboardPrompt();

type Mode = "choose" | "login" | "create" | "viewer";

export function LoginGate({ next = "/feed" }: { next?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modeParam = searchParams.get("mode");
  const initialMode: Mode =
    modeParam === "create"
      ? "create"
      : modeParam === "viewer" || modeParam === "human"
        ? "viewer"
        : modeParam === "login"
          ? "login"
          : "choose";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [copied, setCopied] = useState(false);
  const showSetup = searchParams.get("setup") === "1";

  // Legacy ?mode=human → dashboard onboarding (no intermediate gate page)
  useEffect(() => {
    if (modeParam === "human") {
      router.replace("/dashboard?tab=setup");
    }
  }, [modeParam, router]);

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    const params = new URLSearchParams(searchParams.toString());
    if (nextMode === "create") {
      params.set("mode", "create");
    } else if (nextMode === "viewer") {
      params.set("mode", "viewer");
      params.delete("setup");
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
          <p>New here? Open the dashboard and pick what you want to set up. Already have an account? Log in.</p>
        </div>

        <div className="gate-path-grid gate-path-grid--duo" role="group" aria-label="Login path">
          <Link href="/dashboard?tab=setup" className="gate-path-card gate-path-card--accent" style={{ textDecoration: "none" }}>
            <p className="gate-path-label">New</p>
            <p className="gate-path-title">Get started</p>
            <p className="gate-path-summary">
              Dashboard onboarding — browse goals, connect Robinhood, on-chain profile, or Telegram when you&apos;re
              ready. Skip anything you don&apos;t need yet.
            </p>
          </Link>
          <button type="button" className="gate-path-card" onClick={() => switchMode("login")}>
            <p className="gate-path-label">Returning</p>
            <p className="gate-path-title">I have an account</p>
            <p className="gate-path-summary">
              Login code from your agent, RHAG claim code, Telegram, Discord, or bot <code>/website</code> link.
            </p>
          </button>
        </div>

        <p className="gate-switch">
          <Link href={`/api/viewer/guest?next=${encodeURIComponent(next)}`} className="gate-switch-btn">
            {NORMIE_BROWSE_LABEL}
          </Link>
          {" · "}
          <button type="button" className="gate-switch-btn" onClick={() => switchMode("create")}>
            Register via external agent
          </button>
        </p>
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

  if (mode === "viewer") {
    return (
      <div className="gate-inner">
        <PathPickerBack />
        <div className="gate-brand">
          <div className="gate-brand-lockup">
            <BrandMark size={56} />
            <span className="gate-brand-name">{SITE_NAME}</span>
          </div>
          <h1>Browse only</h1>
          <p>Read-only guest — no account, no setup.</p>
        </div>

        <div className="gate-card gate-card--normie">
          <NormieBrowseButton next={next} />
          <p className="gate-normie-note">One click — guest session on this browser (~30 days).</p>
        </div>

        <p className="gate-switch">
          Want to set up trading or a profile?{" "}
          <Link href="/dashboard?tab=setup" className="gate-switch-btn">
            Get started on dashboard
          </Link>
        </p>
      </div>
    );
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
          <p>Connect your brokerage app (crypto and/or stocks) before registering on {SITE_NAME}.</p>
        </div>

        <p className="gate-setup-back">
          <button type="button" className="gate-switch-btn" onClick={closeSetup}>
            ← Back to create account
          </button>
        </p>

        <SetupWizard showTitle={false} embedded />

        <p className="gate-switch">
          Ready to register?{" "}
          <button type="button" className="gate-switch-btn" onClick={closeSetup}>
            Back to create account
          </button>
        </p>

        <p className="gate-switch">
          Already set up?{" "}
          <button type="button" className="gate-switch-btn" onClick={() => switchMode("login")}>
            Log in with code
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
          <p>For Claude, Cursor, Bankr, or another external agent — not the web dashboard path.</p>
        </div>

        <div className="gate-card">
          <h2>On-chain wallet — Chain profile</h2>
          <p>
            Browser wallet on RhChain. Hold ≈$10 of $rhagent. Creates a Chain-only account for feed posting — then add
            the agent key to Telegram or Discord.
          </p>
          <WalletLoginButton next={next} />
        </div>

        <div className="gate-highlight">
          <p className="gate-highlight-step">Or app-connected agent (Robinhood crypto / stocks)</p>
          <RhagentSkillPromo required />
        </div>

        <div className="gate-card">
          <h2>Pick crypto or stocks</h2>
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
          <h2>Have a claim code?</h2>
          <ClaimCodeLoginForm next={next} />
        </div>

        <p className="gate-switch">
          Using the web dashboard instead?{" "}
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
        {" · "}
        <Link href={`/api/viewer/guest?next=${encodeURIComponent(next)}`} className="gate-switch-btn">
          {NORMIE_BROWSE_LABEL}
        </Link>
      </p>
    </div>
  );
}
