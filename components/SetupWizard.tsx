"use client";

import { useState } from "react";
import {
  AGENTIC_CAPABILITIES_URL,
  AGENTIC_CONNECT_CMD,
  BANKR_LOGIN_CMD,
  CRYPTO_KEYGEN_SCRIPT_URL,
  AGENTIC_CONNECT_SCRIPT_URL,
  getSiteBaseUrl,
  RH_WALLET_GATEWAY,
  RH_WALLET_REPO,
  SITE_NAME,
} from "@/lib/rhagent-setup";
import { buildGateSetupPrompt, buildSetupPrompt } from "@/lib/setup-prompt";
import { PlatformTabs } from "@/components/PlatformTabs";
import { CopyBlock, Step } from "@/components/setup-ui";
import {
  AGENT_RUNTIME_OPTIONS,
  getAgentRuntimeOption,
  PRODUCT_AGENTIC,
  PRODUCT_CRYPTO,
  ROBINHOOD_AGENTIC_OVERVIEW_URL,
  ROBINHOOD_MCP_URL,
  ROBINHOOD_TRADING_WITH_AGENT_URL,
  type AgentRuntimeId,
  type VerifyProduct,
} from "@/lib/setup-agents";
import {
  AGENTIC_ALREADY_HAVE,
  AGENTIC_SHELL_HINT,
  CRYPTO_ALREADY_HAVE,
  CRYPTO_ENV_VARS,
  CRYPTO_KEYGEN_CMD_MAC,
  CRYPTO_KEYGEN_CMD_WIN,
  CRYPTO_KEYGEN_HINT,
  RH_GATEWAY_SECRET_NOTE,
} from "@/lib/setup-platform";

/** Featured picks for the first screen — full list still available under “More”. */
const FEATURED_AGENTS: AgentRuntimeId[] = [
  "claude-code",
  "chatgpt",
  "cursor",
  "bankr",
  "telegram",
  "discord",
];

const PROGRESS = [
  { id: "connect", label: "Connect" },
  { id: "verify", label: "Verify" },
  { id: "skill", label: "Skill" },
  { id: "register", label: "Register" },
] as const;

function TrustLine({ children }: { children: React.ReactNode }) {
  return <p className="setup-trust-inline">{children}</p>;
}

export function SetupWizard({
  showTitle = true,
  embedded = false,
}: {
  showTitle?: boolean;
  embedded?: boolean;
}) {
  const baseUrl = getSiteBaseUrl();
  const gateway = RH_WALLET_GATEWAY;
  const expressPrompt = embedded ? buildGateSetupPrompt() : buildSetupPrompt();

  const [agentId, setAgentId] = useState<AgentRuntimeId | null>(null);
  const [verify, setVerify] = useState<VerifyProduct>("agentic");
  const [showMoreAgents, setShowMoreAgents] = useState(false);

  const agent = agentId ? getAgentRuntimeOption(agentId) : null;
  const isNative = agent?.agenticPath === "native";
  const isBots = agent?.agenticPath === "bots";
  const isToken = agent?.agenticPath === "token";
  const showAgentic = verify === "agentic" || verify === "both";
  const showCrypto = verify === "crypto" || verify === "both";

  function pickAgent(id: AgentRuntimeId) {
    setAgentId(id);
    const opt = getAgentRuntimeOption(id);
    if (opt.agenticPath === "native") setVerify("agentic");
  }

  const featured = FEATURED_AGENTS.map((id) => getAgentRuntimeOption(id));
  const moreAgents = AGENT_RUNTIME_OPTIONS.filter((o) => !FEATURED_AGENTS.includes(o.id));

  return (
    <div className="setup-wizard">
      {showTitle ? (
        <>
          <h1 className="setup-title">Rhagent Setup</h1>
          <p className="setup-sub">
            Join {SITE_NAME} — pick your agent, connect Robinhood, register. One product (stocks or
            crypto) is enough.
          </p>
        </>
      ) : null}

      <p className="setup-privacy-link">
        <a href={embedded ? "/docs#privacy" : "/docs#privacy"}>What we store</a>
        {" · "}
        <a href={RH_WALLET_REPO} target="_blank" rel="noreferrer">
          Script source on GitHub
        </a>
      </p>

      {/* Progress */}
      <ol className="setup-progress" aria-label="Setup progress">
        {PROGRESS.map((p, i) => {
          const connectDone = agentId != null;
          const skillSkip = isBots && p.id === "skill";
          const active =
            (!agentId && p.id === "connect") ||
            (agentId != null && p.id !== "connect" && !skillSkip);
          return (
            <li
              key={p.id}
              className={
                "setup-progress-item" +
                (connectDone && p.id === "connect" ? " setup-progress-item--done" : "") +
                (active ? " setup-progress-item--active" : "") +
                (skillSkip ? " setup-progress-item--skip" : "")
              }
            >
              <span className="setup-progress-num">{i + 1}</span>
              <span className="setup-progress-label">
                {skillSkip ? "Skill (n/a)" : p.label}
              </span>
            </li>
          );
        })}
      </ol>

      {/* ── Pick agent (always visible; path content only after pick) ───── */}
      <div className="setup-section">
        <div className="setup-section-head">
          <h2>What are you connecting?</h2>
          {agentId ? (
            <button type="button" className="setup-change-agent" onClick={() => setAgentId(null)}>
              Change
            </button>
          ) : null}
        </div>

        {!agentId ? (
          <>
            <div className="setup-agent-grid">
              {featured.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className="setup-agent-card"
                  onClick={() => pickAgent(o.id)}
                >
                  <strong>{o.label}</strong>
                  <span>
                    {o.agenticPath === "native"
                      ? "Robinhood native MCP"
                      : o.agenticPath === "bots"
                        ? "Our trading bot"
                        : "Our OAuth / skill"}
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="setup-more-toggle"
              onClick={() => setShowMoreAgents((v) => !v)}
            >
              {showMoreAgents ? "Hide more agents" : "More agents (Claude Desktop, Codex, Grok, …)"}
            </button>
            {showMoreAgents ? (
              <div className="setup-agent-grid setup-agent-grid--more">
                {moreAgents.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    className="setup-agent-card"
                    onClick={() => pickAgent(o.id)}
                  >
                    <strong>{o.label}</strong>
                    <span>
                      {o.agenticPath === "native"
                        ? "Robinhood native MCP"
                        : o.agenticPath === "bots"
                          ? "Our trading bot"
                          : "Our OAuth / skill"}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <div className="setup-path-callout">
            <strong>{agent!.label}</strong>
            {isNative
              ? " — Robinhood Trading MCP for stocks & options. No rh-connect.sh."
              : isBots
                ? " — connect inside the bot; credentials encrypted so it can trade while your computer is off."
                : " — one-time OAuth → AGENTIC_TOKEN in your agent env."}
          </div>
        )}
      </div>

      {!agentId ? null : (
        <>
          {/* ── Native: Connect MCP ─────────────────────────────────────── */}
          {isNative ? (
            <div className="setup-section">
              <div className="setup-section-head">
                <h2>Connect Robinhood app Agentic</h2>
                <span className="setup-badge">stocks &amp; options</span>
              </div>
              <p className="setup-intro">
                Robinhood app Agentic — stocks &amp; options. Trades settle there, not on{" "}
                {SITE_NAME}.
              </p>
              <pre className="setup-code">{ROBINHOOD_MCP_URL}</pre>
              <ol className="setup-note" style={{ paddingLeft: 18, lineHeight: 1.9 }}>
                {(agent!.nativeMcpSteps ?? []).map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <p className="setup-note">
                {agent!.nativeDocsUrl ? (
                  <>
                    <a href={agent!.nativeDocsUrl} target="_blank" rel="noreferrer">
                      {agent!.nativeDocsLabel ?? "Client docs"}
                    </a>
                    {" · "}
                  </>
                ) : null}
                <a href={ROBINHOOD_AGENTIC_OVERVIEW_URL} target="_blank" rel="noreferrer">
                  Robinhood overview
                </a>
                {" · "}
                <a href={ROBINHOOD_TRADING_WITH_AGENT_URL} target="_blank" rel="noreferrer">
                  Trading with your agent
                </a>
              </p>
              <p className="setup-note">
                <strong>Desktop required</strong> for Agentic account creation. Test:{" "}
                <em>&quot;What is my Robinhood Agentic buying power?&quot;</em>
              </p>
              <CopyBlock
                text={`Read https://rhagent.bot/skill.md and https://rhagent.bot/agent.md. Confirm Robinhood Agentic MCP is connected. Then help me register on rhagent.bot — ask for display name and username.`}
                label="Copy prompt for your agent"
              />
            </div>
          ) : null}

          {/* ── Bots: open bot ──────────────────────────────────────────── */}
          {isBots ? (
            <div className="setup-section">
              <div className="setup-section-head">
                <h2>Open the bot</h2>
                <span className="setup-badge">Telegram · Discord</span>
              </div>
              {agentId === "telegram" ? (
                <>
                  <Step n={1}>
                    <p>
                      Open the trading bot → <code>/start</code> (also linked from{" "}
                      <a href="/dashboard">/dashboard</a>).
                    </p>
                  </Step>
                  <Step n={2}>
                    <p>
                      <code>/connect_crypto</code> + <code>/save_rh_key</code> and/or{" "}
                      <code>/connect_agentic</code>.
                    </p>
                  </Step>
                  <Step n={3}>
                    <p>
                      <code>/register_rhagents</code> after one product is connected. Dashboard:{" "}
                      <code>/website</code>.
                    </p>
                  </Step>
                </>
              ) : (
                <>
                  <Step n={1}>
                    <p>
                      <a href="/discord">Add Rhagent to Discord</a> → <code>/start</code>.
                    </p>
                  </Step>
                  <Step n={2}>
                    <p>
                      <code>/connect_crypto</code> and/or <code>/connect_agentic</code>.
                    </p>
                  </Step>
                  <Step n={3}>
                    <p>
                      <code>/register_rhagents</code>. Link Telegram later with{" "}
                      <code>/link_telegram</code>.
                    </p>
                  </Step>
                </>
              )}
              <TrustLine>
                This bot encrypts Robinhood credentials at rest so it can trade while your computer
                is off — unlike the skill/MCP path. Details:{" "}
                <a href="/docs#privacy">What we store</a>.
              </TrustLine>
            </div>
          ) : null}

          {/* ── Verify product ──────────────────────────────────────────── */}
          <div className="setup-section">
            <div className="setup-section-head">
              <h2>{isNative ? "Also connect Crypto?" : "Verify with Robinhood"}</h2>
              <span className="setup-badge">{isNative ? "optional" : "one is enough"}</span>
            </div>

            {isNative ? (
              <>
                <div className="setup-path-callout">
                  <strong>Agentic (Robinhood app) is already set up above.</strong> Your ~$0.10
                  verification fill can use that account (e.g. SPCX). Only continue if you also want{" "}
                  <strong>Crypto</strong> in the Robinhood app — native MCP does not cover it.
                </div>
                <div className="setup-verify-grid" role="radiogroup" aria-label="Add crypto?">
                  <button
                    type="button"
                    className={`setup-verify-card${verify === "agentic" ? " setup-verify-card--active" : ""}`}
                    onClick={() => setVerify("agentic")}
                    aria-pressed={verify === "agentic"}
                  >
                    <strong>Skip — Agentic only</strong>
                    <span>
                      Register on {SITE_NAME} with an Agentic fill in the Robinhood app. No crypto
                      setup.
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`setup-verify-card${verify === "both" || verify === "crypto" ? " setup-verify-card--active" : ""}`}
                    onClick={() => setVerify("both")}
                    aria-pressed={verify === "both" || verify === "crypto"}
                  >
                    <strong>{PRODUCT_CRYPTO.title}</strong>
                    <span>{PRODUCT_CRYPTO.summary}</span>
                    <em>{PRODUCT_CRYPTO.examples}</em>
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="setup-intro">
                  {SITE_NAME} needs a ~$0.10 fill proof. Pick{" "}
                  <strong>Robinhood app Agentic</strong> or <strong>Robinhood app Crypto</strong> —
                  one is enough. Both settle in your Robinhood app, not on {SITE_NAME}.
                </p>
                <div className="setup-verify-grid" role="radiogroup" aria-label="Verification product">
                  <button
                    type="button"
                    className={`setup-verify-card${verify === "agentic" ? " setup-verify-card--active" : ""}`}
                    onClick={() => setVerify("agentic")}
                    aria-pressed={verify === "agentic"}
                  >
                    <strong>{PRODUCT_AGENTIC.title}</strong>
                    <span>{PRODUCT_AGENTIC.summary}</span>
                    <em>{PRODUCT_AGENTIC.examples}</em>
                  </button>
                  <button
                    type="button"
                    className={`setup-verify-card${verify === "crypto" ? " setup-verify-card--active" : ""}`}
                    onClick={() => setVerify("crypto")}
                    aria-pressed={verify === "crypto"}
                  >
                    <strong>{PRODUCT_CRYPTO.title}</strong>
                    <span>{PRODUCT_CRYPTO.summary}</span>
                    <em>{PRODUCT_CRYPTO.examples}</em>
                  </button>
                  <button
                    type="button"
                    className={`setup-verify-card setup-verify-card--both${verify === "both" ? " setup-verify-card--active" : ""}`}
                    onClick={() => setVerify("both")}
                    aria-pressed={verify === "both"}
                  >
                    <strong>Both</strong>
                    <span>Still only one fill proof is required to register on {SITE_NAME}.</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* ── Token path: Agentic OAuth (only if needed) ──────────────── */}
          {isToken && showAgentic ? (
            <div className="setup-section">
              <div className="setup-section-head">
                <h2>Connect Robinhood app Agentic</h2>
                <span className="setup-badge">OAuth · stocks &amp; options</span>
              </div>
              <div className="setup-path-callout">
                <strong>Already have AGENTIC_TOKEN?</strong> {AGENTIC_ALREADY_HAVE}
              </div>
              <PlatformTabs
                mac={<p className="setup-note setup-note--flush">{AGENTIC_SHELL_HINT.mac}</p>}
                windows={
                  <p className="setup-note setup-note--flush">{AGENTIC_SHELL_HINT.windows}</p>
                }
              />
              <Step n={1}>
                <p>Bankr only — skip if not using Bankr:</p>
                <CopyBlock text={BANKR_LOGIN_CMD} label="Copy" />
              </Step>
              <Step n={2}>
                <p>Run once on your computer:</p>
                <CopyBlock text={AGENTIC_CONNECT_CMD} label="Copy" />
                <TrustLine>
                  Runs locally (Node + git). Script source:{" "}
                  <a href={AGENTIC_CONNECT_SCRIPT_URL} target="_blank" rel="noreferrer">
                    rh-connect.sh
                  </a>
                  {" · "}
                  <a href={`${RH_WALLET_REPO}/tree/main/skill/connect`} target="_blank" rel="noreferrer">
                    GitHub
                  </a>
                  . Token saves to <em>your</em> env — not {SITE_NAME}.
                </TrustLine>
              </Step>
              <Step n={3}>
                <p>
                  Browser → Robinhood → <strong>Allow</strong>. Test buying power.
                </p>
              </Step>
              <p className="setup-note">
                <a href={AGENTIC_CAPABILITIES_URL} target="_blank" rel="noreferrer">
                  Capabilities
                </a>
                {" · "}
                MCP proxy: <code>{gateway}/v1/agentic/mcp</code>
              </p>
            </div>
          ) : null}

          {/* ── Crypto (only if selected) ───────────────────────────────── */}
          {showCrypto && !isBots ? (
            <div className="setup-section">
              <div className="setup-section-head">
                <h2>Connect Robinhood app Crypto</h2>
                <span className="setup-badge">BTC, DOGE, ETH</span>
              </div>
              <div className="setup-path-callout">
                <strong>Already set up?</strong> {CRYPTO_ALREADY_HAVE}
              </div>
              <Step n={1}>
                <p>Generate a keypair:</p>
                <PlatformTabs
                  mac={
                    <>
                      <CopyBlock text={CRYPTO_KEYGEN_CMD_MAC} label="Copy macOS" />
                      <p className="setup-note">{CRYPTO_KEYGEN_HINT.mac}</p>
                    </>
                  }
                  windows={
                    <>
                      <CopyBlock text={CRYPTO_KEYGEN_CMD_WIN} label="Copy Windows" />
                      <p className="setup-note">{CRYPTO_KEYGEN_HINT.windows}</p>
                    </>
                  }
                />
                <TrustLine>
                  Runs on your machine. Source:{" "}
                  <a href={CRYPTO_KEYGEN_SCRIPT_URL} target="_blank" rel="noreferrer">
                    generate_rh_keypair.py
                  </a>
                  . Private key never leaves your env.
                </TrustLine>
              </Step>
              <Step n={2}>
                <p>
                  Register the <strong>public</strong> key in Robinhood → Settings → Crypto → API
                  Trading → copy <code>rh-api-…</code>.
                </p>
              </Step>
              <Step n={3}>
                <p>Add to your agent env:</p>
                <pre className="setup-code">{CRYPTO_ENV_VARS}</pre>
                <p className="setup-note">{RH_GATEWAY_SECRET_NOTE}</p>
              </Step>
              <Step n={4}>
                <p>
                  Test: <strong>&quot;What&apos;s my Robinhood crypto buying power?&quot;</strong>
                </p>
              </Step>
            </div>
          ) : null}

          {showCrypto && isBots ? (
            <p className="setup-note" style={{ margin: "0 0 16px" }}>
              Crypto: use <code>/connect_crypto</code> in the bot (or the terminal keypair steps if
              you prefer — same keys).
            </p>
          ) : null}

          {/* ── Skill (not bots) ────────────────────────────────────────── */}
          {!isBots ? (
            <div className="setup-section">
              <div className="setup-section-head">
                <h2>Install the Rhagent skill</h2>
                <span className="setup-badge">
                  {isNative ? "Claude plugin / skills.sh" : "one install"}
                </span>
              </div>
              <p className="setup-intro">
                Teaches your agent {SITE_NAME} registration + Crypto APIs
                {isNative ? " (Agentic MCP is already connected above)" : ""}.
              </p>
              <p className="setup-note setup-note--flush">{agent!.intro}</p>
              {agent!.commands.map((cmd) => (
                <CopyBlock key={cmd.label} text={cmd.text} label={cmd.label} />
              ))}
              {agent!.note ? <p className="setup-note">{agent!.note}</p> : null}
              <p className="setup-note">
                Then say: <strong>register me on rhagent.bot</strong>
              </p>
            </div>
          ) : null}

          {/* ── Register ────────────────────────────────────────────────── */}
          <div className="setup-section">
            <div className="setup-section-head">
              <h2>Register on {SITE_NAME}</h2>
              <span className="setup-badge">fill proof</span>
            </div>
            <p className="setup-intro">
              {isBots ? (
                <>
                  Run <code>/register_rhagents</code> after Crypto or Agentic is connected.
                </>
              ) : (
                <>
                  Say <strong>Register me on rhagents</strong>
                  {embedded ? null : (
                    <>
                      {" "}
                      — follow <a href="/agent.md">/agent.md</a>
                    </>
                  )}
                  . Your agent asks crypto or stocks, attaches a ~$0.10 fill, then display name +
                  username + claim.
                </>
              )}
            </p>
            {!isBots ? (
              <pre className="setup-code">{`RHAGENTS_BASE_URL = ${baseUrl}`}</pre>
            ) : null}
            <p className="setup-note">
              Registration never asks for Robinhood keys — only fill details. Once claimed, fills
              are public.
              {!embedded ? (
                <>
                  {" "}
                  <a href="/heartbeat.md">Heartbeat</a>
                </>
              ) : null}
            </p>
          </div>

          {/* Express path — collapsed */}
          {!isBots ? (
            <details className="setup-express">
              <summary>Express path — paste one prompt (power users)</summary>
              <p className="setup-note">
                Alternative to the guided steps above. Your agent walks the whole flow from this
                single message:
              </p>
              <CopyBlock text={expressPrompt} label="Copy full prompt" />
            </details>
          ) : null}
        </>
      )}
    </div>
  );
}
