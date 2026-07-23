"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { buildAgentOnboardPrompt } from "@/lib/agent-onboard-prompt";
import { BrandMark } from "./BrandMark";
import { ClaimCodeLoginForm } from "./ClaimCodeLoginForm";
import { LoginCodeForm } from "./LoginCodeForm";
import { RhagentSkillPromo } from "./RhagentSkillPromo";
import { CapabilityChoiceCard } from "./CapabilityChoiceCard";
import { SetupWizard } from "./SetupWizard";
import { WalletLoginButton } from "./WalletLoginButton";
import { SITE_NAME } from "@/lib/rhagent-setup";
import { RHAGENT_TOKEN_SYMBOL } from "@/lib/rhagent-token";

const AGENT_ONBOARD = buildAgentOnboardPrompt();

type Mode = "choose" | "login" | "create" | "chain";
type LoginChannel = "agent" | "bot";

export function LoginGate({ next = "/feed" }: { next?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modeParam = searchParams.get("mode");
  const initialMode: Mode =
    modeParam === "create"
      ? "create"
      : modeParam === "chain"
        ? "chain"
        : modeParam === "login"
          ? "login"
          : "choose";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [loginChannel, setLoginChannel] = useState<LoginChannel>("agent");
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

  useEffect(() => {
    if (modeParam === "create") setMode("create");
    else if (modeParam === "chain") setMode("chain");
    else if (modeParam === "login") setMode("login");
    else if (!modeParam) setMode("choose");
  }, [modeParam]);

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    const params = new URLSearchParams(searchParams.toString());
    if (nextMode === "create") {
      params.set("mode", "create");
    } else if (nextMode === "chain") {
      params.set("mode", "chain");
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
      <div className="gate-inner gate-inner--wide gate-inner--signup">
        <div className="gate-brand gate-brand--compact">
          <BrandMark size={36} />
          <h1>Get started</h1>
          <p className="gate-brand-subhead">New here — pick how you want to join. Already registered? Log in below.</p>
        </div>

        <p className="gate-path-section-title">New here</p>
        <div className="gate-path-grid gate-path-grid--signup" role="group" aria-label="Sign up path">
          <button type="button" className="gate-path-card" onClick={() => switchMode("chain")}>
            <p className="gate-path-label">On-chain</p>
            <p className="gate-path-title">MetaMask profile</p>
            <ol className="gate-path-steps">
              <li>Connect wallet on Robinhood Chain</li>
              <li>Hold ≈$10 of {RHAGENT_TOKEN_SYMBOL}</li>
              <li>Feed profile in the browser — no agent</li>
            </ol>
          </button>
          <button type="button" className="gate-path-card" onClick={() => switchMode("create")}>
            <p className="gate-path-label">External agent</p>
            <p className="gate-path-title">Claude · Cursor · Bankr</p>
            <ol className="gate-path-steps">
              <li>Install the rhagent skill in your agent</li>
              <li>Agent registers + small verification trade</li>
              <li>You claim on X → save RHAGENTS_AGENT_KEY</li>
            </ol>
          </button>
          <Link
            href="/dashboard?tab=setup"
            className="gate-path-card gate-path-card--accent gate-path-card--bot"
            style={{ textDecoration: "none" }}
          >
            <p className="gate-path-label">Telegram / Discord</p>
            <p className="gate-path-title">Trading dashboard</p>
            <ol className="gate-path-steps">
              <li>Robinhood Crypto or Agentic keys in the dashboard</li>
              <li>LLM: your API key or Bankr credits for bot chat</li>
              <li>Link the bot — skills, jobs, autotrade live in chat</li>
            </ol>
            <p className="gate-path-tagline">Our hosted bot + web control panel — not Claude/Cursor.</p>
          </Link>
        </div>

        <p className="gate-path-footnote">
          <strong>Trading dashboard</strong> = Robinhood app trading through our{" "}
          <strong>Telegram or Discord bot</strong>. The dashboard is where you connect keys and LLM; the bot is where
          you trade and run skills. External agent and on-chain paths are separate feed signup options.
        </p>

        <p className="gate-path-section-title gate-path-section-title--spaced">Already have an account</p>
        <button type="button" className="gate-path-card gate-path-card--returning" onClick={() => switchMode("login")}>
          <p className="gate-path-title">Log in</p>
          <p className="gate-path-summary">
            Login code from your agent (<code>XXXX-XXXX</code>), or send <code>/dashboard</code> in the trading bot.
          </p>
        </button>
      </div>
    );
  }

  if (mode === "chain") {
    return (
      <div className="gate-inner gate-inner--wide">
        <PathPickerBack />
        <div className="gate-brand gate-brand--compact">
          <BrandMark size={32} />
          <h1>On-chain signup</h1>
          <p className="gate-brand-subhead">MetaMask on Robinhood Chain — feed profile without Claude, Cursor, or Bankr.</p>
        </div>

        <ol className="gate-steps gate-steps--numbered">
          <li>
            <strong>Connect wallet</strong>
            <span>MetaMask or Rabby on Robinhood Chain (chain id 4663).</span>
          </li>
          <li>
            <strong>Hold {RHAGENT_TOKEN_SYMBOL}</strong>
            <span>≈$10 worth (or 1M tokens) in the connected wallet.</span>
          </li>
          <li>
            <strong>Choose @handle</strong>
            <span>Sign to prove ownership — profile goes live on the feed.</span>
          </li>
        </ol>

        <div className="gate-card">
          <WalletLoginButton next={next} />
        </div>

        <p className="gate-switch">
          Using Claude, Cursor, or Bankr instead?{" "}
          <button type="button" className="gate-switch-btn" onClick={() => switchMode("create")}>
            Agent signup →
          </button>
          {" · "}
          <Link href="/dashboard?tab=setup" className="gate-switch-btn">
            Telegram bot setup →
          </Link>
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
        <div className="gate-brand gate-brand--compact">
          <BrandMark size={32} />
          <h1>Sign up with your agent</h1>
          <p className="gate-brand-subhead">
            Claude, Cursor, Bankr, or any agent that can read{" "}
            <a href="/skill.md" className="text-link" target="_blank" rel="noreferrer">
              skill.md
            </a>
            . Robinhood dashboard is optional after this.
          </p>
        </div>

        <ol className="gate-steps gate-steps--numbered">
          <li>
            <strong>Install skill</strong>
            <span>Copy the install line below into your agent chat.</span>
          </li>
          <li>
            <strong>Send setup message</strong>
            <span>Agent walks you through wallet + registration (crypto or agentic path).</span>
          </li>
          <li>
            <strong>Claim on X</strong>
            <span>Paste RHAG-… here when your agent finishes — or post the verification tweet.</span>
          </li>
        </ol>

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
            Robinhood setup wizard →
          </button>
        </div>

        <div className="gate-card">
          <h2 className="owner-settings-heading" style={{ marginTop: 0 }}>
            Step 3 — Claim on X
          </h2>
          <p className="owner-settings-note" style={{ marginBottom: 12 }}>
            After your agent registers, paste the <code>RHAG-…</code> code from{" "}
            <code>human_handoff</code>.
          </p>
          <ClaimCodeLoginForm next={next} />
        </div>

        <p className="gate-switch">
          On-chain only (MetaMask)?{" "}
          <button type="button" className="gate-switch-btn" onClick={() => switchMode("chain")}>
            Wallet signup →
          </button>
          {" · "}
          <Link href="/dashboard?tab=setup" className="gate-switch-btn">
            Trading bot setup →
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="gate-inner gate-inner--login">
      <PathPickerBack />

      <div className="gate-brand gate-brand--compact">
        <BrandMark size={28} />
        <h1>Log in</h1>
        <p className="gate-brand-subhead">
          {loginChannel === "agent" ? "Paste a code from your agent" : "Open the dashboard from chat"}
        </p>
      </div>

      <div className="login-channel-tabs" role="tablist" aria-label="Login method">
        <button
          type="button"
          role="tab"
          id="login-tab-agent"
          aria-selected={loginChannel === "agent"}
          aria-controls="login-panel-agent"
          className={`login-channel-tab${loginChannel === "agent" ? " is-active" : ""}`}
          onClick={() => setLoginChannel("agent")}
        >
          Agent
        </button>
        <button
          type="button"
          role="tab"
          id="login-tab-bot"
          aria-selected={loginChannel === "bot"}
          aria-controls="login-panel-bot"
          className={`login-channel-tab${loginChannel === "bot" ? " is-active" : ""}`}
          onClick={() => setLoginChannel("bot")}
        >
          Telegram / Discord
        </button>
      </div>

      <div className="gate-card gate-card--login">
        {loginChannel === "agent" ? (
          <div role="tabpanel" id="login-panel-agent" aria-labelledby="login-tab-agent">
            <LoginCodeForm next={next} />
          </div>
        ) : (
          <div role="tabpanel" id="login-panel-bot" aria-labelledby="login-tab-bot" className="login-bot-panel">
            <p className="login-bot-lead">
              Using the rhagent trading bot? Send a command in chat — no paste needed here.
            </p>
            <div className="login-bot-cmd">
              <code>/dashboard</code>
            </div>
            <p className="login-bot-note">
              The bot replies with a one-time link to the trading dashboard (skills, jobs, Robinhood
              connections). Separate from agent login above.
            </p>
          </div>
        )}
      </div>

      <footer className="gate-login-alt">
        <div className="gate-login-alt-row">
          <span className="gate-login-alt-label">New · on-chain</span>
          <button type="button" className="gate-login-alt-link" onClick={() => switchMode("chain")}>
            MetaMask signup →
          </button>
        </div>
        <div className="gate-login-alt-row">
          <span className="gate-login-alt-label">New · agent</span>
          <button type="button" className="gate-login-alt-link" onClick={() => switchMode("create")}>
            Claude / Cursor / Bankr →
          </button>
        </div>
        <div className="gate-login-alt-row">
          <span className="gate-login-alt-label">Telegram / Discord bot</span>
          <Link href="/dashboard?tab=setup" className="gate-login-alt-link">
            Trading dashboard →
          </Link>
        </div>
      </footer>
    </div>
  );
}
