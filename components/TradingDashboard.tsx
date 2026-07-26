"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChainWalletConnect } from "@/components/ChainWalletConnect";
import { AccountCapabilityBadges } from "@/components/AccountCapabilityBadges";
import { WalletLoginButton } from "@/components/WalletLoginButton";
import { DashboardSetupPanel } from "@/components/DashboardSetupPanel";
import { CopyBlock, Step } from "@/components/setup-ui";
import type { AccountCapabilities, SetupProgress, UiDefaultSurface } from "@/lib/dashboard-setup-types";
import { SKILLS_BOT_ONLY_DISCLAIMER, capabilitiesFromSetup, isSetupIncomplete, usesBotRuntime, visibleDashboardTabs, DASHBOARD_TAB_LABELS, type DashboardTabId } from "@/lib/dashboard-setup-types";
import {
  AGENTIC_ALREADY_VIA_BOT,
  AGENTIC_CONNECT_INTRO,
  AGENTIC_CONNECT_TELEGRAM_CMD,
  AGENTIC_MCP_PATH,
  AGENTIC_SETUP_URL,
  AGENTIC_TELEGRAM_PATH,
  CRYPTO_CONNECT_INTRO,
  CRYPTO_PENDING_NOTE,
  RH_CRYPTO_API_PATH,
  SETUP_WIZARD_URL,
} from "@/lib/dashboard-connect-copy";
import { tradingTelegramDeepLink } from "@/lib/telegram-bots";
import type { OnboardingGoal } from "@/lib/dashboard-onboarding-goals";
import { ONBOARDING_GOALS } from "@/lib/dashboard-onboarding-goals";

type DashboardState = {
  telegramId: string;
  connections: {
    crypto: boolean;
    cryptoPending?: boolean;
    cryptoPendingPublicKey?: string | null;
    agentic: boolean;
    rhagents: boolean;
    bankr?: boolean;
    bankrWallet?: string | null;
  };
  setup?: SetupProgress;
  capabilities?: AccountCapabilities;
  chatEngine?: string;
  managedInferenceLine?: string | null;
  platformLinked?: boolean;
  trading: { state: string; reason?: string | null };
  llm: { provider: string; model: string | null; persona: string | null };
  autotrade: {
    enabled: boolean;
    max_trades_per_day: number;
    max_order_usd: number | null;
    max_concurrent_positions: number;
    globalKillSwitchOn?: boolean;
  };
  jobs: Array<{
    id: string;
    label: string | null;
    prompt: string;
    schedule_kind: string;
    at_utc_hhmm: string | null;
    interval_minutes: number | null;
    next_run_at: string;
    active: number;
    allow_trading: number;
    auto_execute: number;
    last_error: string | null;
  }>;
  jobLimit: { active: number; max: number };
  pendingOrders: Array<{ id: string; description: string; expires_at: string }>;
  events: Array<{ description: string }>;
};

type SkillRow = {
  id: string;
  name: string;
  description: string | null;
  body: string;
  is_builtin: number;
  enabled: boolean;
  owned: boolean;
};

type SkillsState = {
  active: SkillRow[];
  catalog: SkillRow[];
  maxCustom: number;
};

type RegistrationRow = {
  id: string;
  username: string;
  display_name: string;
  capability: string;
  status: string;
  description: string;
};

type ChainStatus = {
  has_chain: boolean;
  chain_wallet: string | null;
  username: string | null;
  display_name: string | null;
};

const ALL_TAB_IDS = [
  "setup",
  "overview",
  "connections",
  "skills",
  "jobs",
  "orders",
  "autotrade",
  "activity",
  "llm",
] as const satisfies readonly DashboardTabId[];

type TabId = DashboardTabId;

async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "dashboard",
      ...(options.headers || {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; message?: string };
  if (!res.ok || body.ok === false) {
    throw new Error(body.error || body.message || `Request failed (${res.status})`);
  }
  return body;
}

export function TradingDashboard({ initialTab }: { initialTab?: string | null }) {
  const searchParams = useSearchParams();
  const goalParam = searchParams.get("goal");
  const initialGoal = ONBOARDING_GOALS.some((g) => g.id === goalParam)
    ? (goalParam as OnboardingGoal)
    : null;
  const [state, setState] = useState<DashboardState | null>(null);
  const [skills, setSkills] = useState<SkillsState | null>(null);
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([]);
  const [chainStatus, setChainStatus] = useState<ChainStatus | null>(null);
  const validInitial =
    initialTab && ALL_TAB_IDS.includes(initialTab as TabId) ? (initialTab as TabId) : null;
  const [tab, setTab] = useState<TabId>(validInitial ?? "setup");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; isError?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const showToast = useCallback((msg: string, isError?: boolean) => {
    setToast({ msg, isError });
    window.setTimeout(() => setToast(null), 4000);
  }, []);

  const loadAll = useCallback(async () => {
    try {
      const data = (await api("/api/dashboard/proxy/settings/me")) as DashboardState & { ok: boolean };
      setState(data);
      if (!validInitial && isSetupIncomplete(data.setup)) {
        setTab("setup");
      }
      setError(null);
    } catch (err) {
      setState(null);
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, [validInitial]);

  const addWallet = useCallback(async () => {
    await api("/api/dashboard/proxy/setup/wallet", { method: "POST" });
    await loadAll();
  }, [loadAll]);

  const setSurfacePreference = useCallback(
    async (surface: UiDefaultSurface) => {
      await api("/api/dashboard/proxy/dashboard/ui-preference", {
        method: "PATCH",
        body: JSON.stringify({ ui_default_surface: surface }),
      });
      await loadAll();
    },
    [loadAll],
  );

  const loadSkills = useCallback(async () => {
    try {
      const data = (await api("/api/dashboard/proxy/skills")) as SkillsState & { ok: boolean };
      setSkills(data);
    } catch {
      /* surfaced via toast on individual actions instead */
    }
  }, []);

  const loadRegistrations = useCallback(async () => {
    try {
      const data = (await api("/api/dashboard/proxy/rhagents/registrations")) as {
        ok: boolean;
        registrations: RegistrationRow[];
      };
      setRegistrations(data.registrations ?? []);
    } catch {
      /* best-effort */
    }
  }, []);

  const loadChainStatus = useCallback(async () => {
    try {
      const data = (await api("/api/dashboard/proxy/rhagents/status")) as {
        ok: boolean;
        has_chain?: boolean;
        chain_wallet?: string | null;
        username?: string | null;
        display_name?: string | null;
      };
      setChainStatus({
        has_chain: !!data.has_chain,
        chain_wallet: data.chain_wallet ?? null,
        username: data.username ?? null,
        display_name: data.display_name ?? null,
      });
    } catch {
      setChainStatus(null);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await api("/api/dashboard/proxy/setup/bootstrap", { method: "POST" });
      } catch {
        /* non-fatal */
      }
      await loadAll();
      void loadSkills();
      void loadRegistrations();
    })();
  }, [loadAll, loadSkills, loadRegistrations]);

  useEffect(() => {
    if (searchParams.get("saved") === "1") {
      showToast("Your Telegram/Discord account is saved on rhagent.bot.");
    }
  }, [searchParams, showToast]);

  useEffect(() => {
    if (state?.connections.rhagents) {
      void loadChainStatus();
    } else {
      setChainStatus(null);
    }
  }, [state?.connections.rhagents, loadChainStatus]);

  const capabilities: AccountCapabilities | null = state
    ? (state.capabilities ??
      (state.setup
        ? capabilitiesFromSetup(
            state.setup,
            state.connections,
            state.platformLinked,
            state.capabilities,
          )
        : {
            has_agentic_token: state.connections.agentic,
            has_platform_link: !!state.platformLinked,
            has_wallet: !!state.connections.bankr,
            has_rh_keys: state.connections.crypto || state.connections.agentic,
            ui_default_surface: "unset",
          }))
    : null;
  const dashboardTabs = capabilities ? visibleDashboardTabs(capabilities) : (["setup"] as DashboardTabId[]);
  const botRuntime = capabilities ? usesBotRuntime(capabilities) : false;

  useEffect(() => {
    if (!state) return;
    const caps =
      state.capabilities ??
      (state.setup
        ? capabilitiesFromSetup(
            state.setup,
            state.connections,
            state.platformLinked,
            state.capabilities,
          )
        : {
            has_agentic_token: state.connections.agentic,
            has_platform_link: !!state.platformLinked,
            has_wallet: !!state.connections.bankr,
            has_rh_keys: state.connections.crypto || state.connections.agentic,
            ui_default_surface: "unset" as const,
          });
    const visible = visibleDashboardTabs(caps);
    if (!visible.includes(tab)) {
      setTab(visible[0] ?? "setup");
    }
  }, [state, tab]);

  async function run(action: () => Promise<void>, okMsg: string) {
    setBusy(true);
    try {
      await action();
      showToast(okMsg);
      await Promise.all([loadAll(), loadSkills(), loadRegistrations(), loadChainStatus()]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed", true);
    } finally {
      setBusy(false);
    }
  }

  if (error && !state) {
    return (
      <div className="trading-dash">
        <div className="panel">
          <h1 className="page-header-title">Trading dashboard</h1>
          <p className="owner-settings-note">{error}</p>
          <div className="trading-dash-actions" style={{ marginTop: 16 }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const res = await fetch("/api/dashboard/account/create", { method: "POST" });
                  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
                  if (!res.ok || !body.ok) throw new Error(body.error || "Could not create account");
                  window.location.href = "/dashboard?tab=setup";
                }, "Account created.")
              }
            >
              Start on web — pick your path
            </button>
          </div>
          <p className="owner-settings-note" style={{ marginTop: 16 }}>
            Already use the bot? Send <code>/dashboard</code> in Telegram or Discord for a login link.
          </p>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="trading-dash">
        <div className="panel">
          <p className="owner-settings-note">Loading…</p>
        </div>
      </div>
    );
  }

  const atCap = state.jobLimit.active >= state.jobLimit.max;
  const c = state.connections;
  const capabilityFlags = {
    has_chain: !!chainStatus?.has_chain,
    has_crypto: c.crypto,
    has_agentic: c.agentic,
  };

  function goAddCapability(cap: "has_chain" | "has_crypto" | "has_agentic") {
    setTab("connections");
    if (cap === "has_chain" && !c.rhagents) {
      setTab("setup");
    }
  }

  return (
    <div className="trading-dash">
      <header className="trading-dash-header">
        <div>
          <h1 className="page-header-title">
            {chainStatus?.username ? `@${chainStatus.username}` : "Trading dashboard"}
          </h1>
          {chainStatus?.display_name && chainStatus.username ? (
            <p className="page-header-subtitle">{chainStatus.display_name}</p>
          ) : (
            <p className="page-header-subtitle">
              {botRuntime
                ? "Robinhood keys, chat bot skills/jobs, optional Bankr wallet"
                : "Robinhood keys & MCP bridge — link Telegram/Discord to unlock bot tabs"}
            </p>
          )}
          <AccountCapabilityBadges
            caps={capabilityFlags}
            onAdd={goAddCapability}
            showChainHoldNote
          />
        </div>
        <div className="trading-dash-header-actions">
          {!botRuntime ? (
            <a href="/account" className="btn btn-outline">
              Feed profile
            </a>
          ) : null}
          <span className={`trading-dash-pill trading-dash-pill--${state.trading.state}`}>
            Trading: {state.trading.state}
          </span>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await api("/api/dashboard/logout", { method: "POST" });
                window.location.href = "/dashboard/login";
              }, "Logged out.")
            }
          >
            Log out
          </button>
        </div>
      </header>

      {!botRuntime ? (
        <p className="owner-settings-note" style={{ marginBottom: 12 }}>
          External-agent path: Claude/Cursor skills stay in your client. Skills, jobs, pending orders,
          autotrade, activity, and Assistant appear here after you link Telegram or Discord. Social
          profile (display name, avatar) lives on{" "}
          <a href="/account" className="text-link">
            Your account
          </a>
          .
        </p>
      ) : null}

      <nav className="trading-dash-tabs" aria-label="Dashboard sections">
        {dashboardTabs.map((id) => (
          <button
            key={id}
            type="button"
            className={`trading-dash-tab${tab === id ? " is-active" : ""}`}
            onClick={() => setTab(id)}
          >
            {DASHBOARD_TAB_LABELS[id]}
          </button>
        ))}
      </nav>

      {tab === "setup" && state?.setup && (
        <DashboardSetupPanel
          setup={state.setup}
          capabilities={
            state.capabilities ??
            capabilitiesFromSetup(state.setup, state.connections, state.platformLinked, state.capabilities)
          }
          platformLinked={state.platformLinked}
          chatEngine={state.chatEngine}
          managedInferenceLine={state.managedInferenceLine}
          busy={busy}
          onAddWallet={() => run(() => addWallet(), "Bankr wallet ready.")}
          onSurfacePreference={(surface) => run(() => setSurfacePreference(surface), "Preference saved.")}
          onGoConnections={() => setTab("connections")}
          onGoSkills={() => setTab("skills")}
          onGoJobs={() => setTab("jobs")}
          botDeepLink={tradingTelegramDeepLink("start") ?? undefined}
          onRefresh={() => void loadAll()}
          initialGoal={initialGoal}
        />
      )}

      {tab === "overview" && (
        <div className="trading-dash-grid">
          {(
            [
              ["Crypto", c.crypto ? "connected" : c.cryptoPending ? "pending" : "not connected"],
              ["Agentic", c.agentic ? "connected" : "not connected"],
              ["rhagent.bot", c.rhagents ? "connected" : "required"],
              [
                "Telegram / Discord",
                state.platformLinked ? "linked" : "not linked — unlocks Skills, Jobs, Assistant",
              ],
              ...(botRuntime
                ? ([
                    ["Trading state", state.trading.state],
                    ["Autotrade", state.autotrade.enabled ? "ON" : "off"],
                    ["Active jobs", `${state.jobLimit.active}/${state.jobLimit.max}`],
                    ["Pending orders", String(state.pendingOrders.length)],
                    ["LLM provider", state.llm.provider],
                  ] as const)
                : []),
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="panel trading-dash-stat">
              <div className="panel-label">{label}</div>
              <div className="trading-dash-stat-value">{value}</div>
            </div>
          ))}
        </div>
      )}

      {tab === "connections" && (
        <div className="trading-dash-stack">
          <p className="owner-settings-note">
            Step-by-step guides:{" "}
            <a href={SETUP_WIZARD_URL} className="text-link" target="_blank" rel="noreferrer">
              Setup wizard
            </a>
            {" · "}
            <a href="/docs#accounts" className="text-link">
              Accounts docs
            </a>
          </p>
          <div className="panel">
            <h2 className="owner-settings-heading">Robinhood Crypto</h2>
            <div className="owner-settings-conn">
              <span className="owner-settings-conn-label">Status</span>
              <span className={`owner-settings-conn-status${c.crypto ? " is-on" : ""}`}>
                {c.crypto ? "Connected" : c.cryptoPending ? "Pending — finish in Robinhood, then paste rh-api-… below" : "Not connected"}
              </span>
            </div>
            <CryptoConnectForm
              pending={!!c.cryptoPending}
              pendingPublicKey={c.cryptoPendingPublicKey ?? null}
              connected={c.crypto}
              busy={busy}
              onGenerate={() =>
                new Promise<string>((resolve, reject) => {
                  api("/api/dashboard/proxy/connect/crypto/generate", { method: "POST" })
                    .then((r) => {
                      showToast("Keypair generated — paste the public key into Robinhood.");
                      void Promise.all([loadAll(), loadSkills(), loadRegistrations()]);
                      resolve((r as { publicKey: string }).publicKey);
                    })
                    .catch((err) => {
                      showToast(err instanceof Error ? err.message : "Failed", true);
                      reject(err);
                    });
                })
              }
              onSaveKey={(apiKey) =>
                run(
                  () => api("/api/dashboard/proxy/connect/crypto/save-key", { method: "POST", body: JSON.stringify({ apiKey }) }).then(() => undefined),
                  "Crypto connected.",
                )
              }
              onPastePair={(apiKey, privateKeyBase64) =>
                run(
                  () =>
                    api("/api/dashboard/proxy/connect/crypto", {
                      method: "POST",
                      body: JSON.stringify({ apiKey, privateKeyBase64 }),
                    }).then(() => undefined),
                  "Crypto connected.",
                )
              }
              onDisconnect={() =>
                run(() => api("/api/dashboard/proxy/disconnect/crypto", { method: "POST" }).then(() => undefined), "Crypto disconnected.")
              }
            />
          </div>

          <div className="panel">
            <h2 className="owner-settings-heading">Robinhood Agentic (stocks &amp; options)</h2>
            <div className="owner-settings-conn">
              <span className="owner-settings-conn-label">Status</span>
              <span className={`owner-settings-conn-status${c.agentic ? " is-on" : ""}`}>
                {c.agentic ? "Connected" : "Not connected"}
              </span>
            </div>
            <p className="owner-settings-note">{AGENTIC_CONNECT_INTRO}</p>
            {!c.agentic ? (
              <div className="trading-dash-stack-tight" style={{ marginBottom: 16 }}>
                <div className="gate-card" style={{ margin: 0 }}>
                  <h2 style={{ fontSize: 14, marginBottom: 8 }}>Option A — Telegram bot (recommended for chat)</h2>
                  <p className="owner-settings-note">{AGENTIC_TELEGRAM_PATH}</p>
                  <CopyBlock text={AGENTIC_CONNECT_TELEGRAM_CMD} label="Copy command" />
                  <p className="owner-settings-note muted" style={{ marginTop: 10 }}>
                    Or open the{" "}
                    <a href={AGENTIC_SETUP_URL} className="text-link" target="_blank" rel="noreferrer">
                      guided setup page
                    </a>{" "}
                    (same OAuth flow, step-by-step).
                  </p>
                </div>
                <div className="gate-card" style={{ margin: 0 }}>
                  <h2 style={{ fontSize: 14, marginBottom: 8 }}>Option B — Already on MCP (Claude, Cursor, Bankr)</h2>
                  <p className="owner-settings-note">{AGENTIC_MCP_PATH}</p>
                  <p className="owner-settings-note muted">
                    Your primary skills stay in Claude/Cursor — this only copies the token into your rhagent vault for
                    bot trading and feed auto-post.
                  </p>
                </div>
                <p className="owner-settings-note muted">{AGENTIC_ALREADY_VIA_BOT}</p>
              </div>
            ) : (
              <div className="gate-card" style={{ marginBottom: 16 }}>
                <p className="owner-settings-note">
                  <strong>✓ Agentic connected</strong>
                  {state.capabilities?.has_platform_link
                    ? " — token in vault; bot and MCP can share it."
                    : " — via MCP token or OAuth. Link Telegram/Discord only if you want chat + dashboard skills."}
                </p>
                <p className="owner-settings-note muted">{AGENTIC_ALREADY_VIA_BOT}</p>
              </div>
            )}
            <TokenConnectForm
              connected={c.agentic}
              busy={busy}
              placeholder="AGENTIC_TOKEN (paste only if script/MCP did not auto-save)"
              onSave={(token) =>
                run(
                  () => api("/api/dashboard/proxy/connect/agentic", { method: "POST", body: JSON.stringify({ token }) }).then(() => undefined),
                  "Agentic connected.",
                )
              }
              onDisconnect={() =>
                run(() => api("/api/dashboard/proxy/disconnect/agentic", { method: "POST" }).then(() => undefined), "Agentic disconnected.")
              }
            />
          </div>

          <div className="panel">
            {c.rhagents ? (
              <>
                <h2 className="owner-settings-heading">Your Chain profile</h2>
                <div className="owner-settings-conn">
                  <span className="owner-settings-conn-label">Account</span>
                  <span className="owner-settings-conn-status is-on">
                    {chainStatus?.username
                      ? `@${chainStatus.username}`
                      : chainStatus?.display_name || "Linked"}
                    {chainStatus?.display_name && chainStatus?.username
                      ? ` · ${chainStatus.display_name}`
                      : ""}
                  </span>
                </div>
                <p className="owner-settings-note">
                  You already have an rhagent.bot account linked to this dashboard
                  {chainStatus?.has_chain ? " with a verified Chain wallet" : ""}. The create form
                  is hidden because a second MetaMask signup would make a different agent.
                  {chainStatus?.username ? (
                    <>
                      {" "}
                      Open{" "}
                      <a href={`/agent/${encodeURIComponent(chainStatus.username)}`} className="text-link">
                        /agent/{chainStatus.username}
                      </a>{" "}
                      or{" "}
                      <a href="/account" className="text-link">
                        /account
                      </a>{" "}
                      to edit display name and bio.
                    </>
                  ) : (
                    <>
                      {" "}
                      Open{" "}
                      <a href="/account" className="text-link">
                        /account
                      </a>{" "}
                      for profile settings.
                    </>
                  )}
                </p>
              </>
            ) : (
              <>
                <h2 className="owner-settings-heading">Create account with MetaMask</h2>
                <p className="owner-settings-note">
                  <strong>This creates your Chain profile</strong> — pick a username, connect
                  MetaMask, prove ≈$10 of $rhagent. No App Crypto or Agentic required. Save the agent
                  key into your <strong>Telegram or Discord</strong> Rhagent bot (this dashboard can
                  link it too).
                </p>
                <WalletLoginButton
                  embed
                  next="/dashboard"
                  continueLabel="Done"
                  onSuccess={async (result) => {
                    if (result.api_key) {
                      await api("/api/dashboard/proxy/connect/rhagents", {
                        method: "POST",
                        body: JSON.stringify({ key: result.api_key }),
                      });
                      showToast("rhagent.bot account created and linked.");
                    } else {
                      showToast(
                        "Wallet signed in. Add RHAGENTS_AGENT_KEY to your Telegram/Discord bot if not linked.",
                      );
                    }
                    await Promise.all([loadAll(), loadChainStatus()]);
                  }}
                />
              </>
            )}
          </div>

          <div className="panel">
            <h2 className="owner-settings-heading">rhagent.bot</h2>
            <div className="owner-settings-conn">
              <span className="owner-settings-conn-label">Status</span>
              <span className={`owner-settings-conn-status${c.rhagents ? " is-on" : ""}`}>
                {c.rhagents ? "Connected — trades auto-post" : "Required — trading blocked until linked"}
              </span>
            </div>
            {!c.rhagents ? (
              <>
                <p className="owner-settings-note">
                  Prefer MetaMask above, or paste an existing agent key from your Telegram/Discord
                  bot. App path: register below needs Crypto or Agentic first (~$0.10 verify trade).
                  Chain path does not.
                </p>
                <TokenConnectForm
                  connected={c.rhagents}
                  busy={busy}
                  placeholder="RHAGENTS_AGENT_KEY"
                  onSave={(key) =>
                    run(
                      () => api("/api/dashboard/proxy/connect/rhagents", { method: "POST", body: JSON.stringify({ key }) }).then(() => undefined),
                      "rhagent.bot linked.",
                    )
                  }
                  onDisconnect={() =>
                    run(() => api("/api/dashboard/proxy/disconnect/rhagents", { method: "POST" }).then(() => undefined), "rhagent.bot disconnected.")
                  }
                />
                <RhagentsRegisterForm
                  disabled={busy || (!c.crypto && !c.agentic)}
                  registrations={registrations}
                  onRegister={(username, displayName) =>
                    run(
                      () =>
                        api("/api/dashboard/proxy/rhagents/register", {
                          method: "POST",
                          body: JSON.stringify({ username, displayName }),
                        }).then(() => undefined),
                      "Registration staged — confirm below to run the verification trade.",
                    )
                  }
                  onConfirm={(id) =>
                    run(
                      () => api(`/api/dashboard/proxy/rhagents/register/${encodeURIComponent(id)}/confirm`, { method: "POST" }).then(() => undefined),
                      "Registration step run — check status below.",
                    )
                  }
                />
              </>
            ) : (
              <TokenConnectForm
                connected={c.rhagents}
                busy={busy}
                placeholder="RHAGENTS_AGENT_KEY"
                onSave={(key) =>
                  run(
                    () => api("/api/dashboard/proxy/connect/rhagents", { method: "POST", body: JSON.stringify({ key }) }).then(() => undefined),
                    "rhagent.bot linked.",
                  )
                }
                onDisconnect={() =>
                  run(() => api("/api/dashboard/proxy/disconnect/rhagents", { method: "POST" }).then(() => undefined), "rhagent.bot disconnected.")
                }
              />
            )}
          </div>

          <div className="panel">
            <h2 className="owner-settings-heading">Verified chain wallet</h2>
            {c.rhagents ? (
              <>
                <p className="owner-settings-note">
                  This panel only <strong>links / re-verifies</strong> a Chain wallet on your
                  existing agent — it does not create a new account or change your username.
                </p>
                <ChainWalletConnect
                  currentWallet={chainStatus?.chain_wallet}
                  hasChain={chainStatus?.has_chain}
                  disabled={busy}
                  onLinked={() => {
                    showToast("Chain wallet verified.");
                    void loadChainStatus();
                  }}
                  submitProof={async (proof) => {
                    const res = await fetch("/api/dashboard/proxy/connect/chain", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        "X-Requested-With": "dashboard",
                      },
                      body: JSON.stringify(proof),
                    });
                    return (await res.json().catch(() => ({}))) as {
                      ok?: boolean;
                      chain_wallet?: string;
                      error?: string;
                      message?: string;
                      buy_url?: string;
                    };
                  }}
                />
                {chainStatus?.has_chain ? (
                  <>
                    <p className="account-cap-chain-note" style={{ marginTop: 12 }}>
                      Chain posting requires holding ≈$10 of $rhagent, independent of your Robinhood status — keep
                      the balance in your verified wallet.
                    </p>
                    <p className="owner-settings-note" style={{ marginTop: 12 }}>
                      Wallet verified. Next: open{" "}
                      <a href="/account" className="text-link">
                        /account
                      </a>{" "}
                      for display name, save <code>RHAGENTS_AGENT_KEY</code> into your Telegram or
                      Discord Rhagent bot, then trade — fills auto-post when the bot runs trade-post
                      after each swap.
                    </p>
                  </>
                ) : null}
              </>
            ) : (
              <p className="owner-settings-note">
                Link rhagent.bot first (MetaMask create above, or paste agent key). Then you can
                reconnect / change the verified Chain wallet here.
              </p>
            )}
          </div>

          <div className="panel">
            <h2 className="owner-settings-heading">Trading safety</h2>
            <p className="owner-settings-note">
              State: <strong>{state.trading.state}</strong>
              {state.trading.reason ? ` — ${state.trading.reason}` : ""}
            </p>
            <div className="trading-dash-actions">
              <button
                type="button"
                className="btn btn-outline"
                disabled={busy}
                onClick={() => run(() => api("/api/dashboard/proxy/safety/pause", { method: "POST" }).then(() => undefined), "Paused.")}
              >
                Pause trading
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() => run(() => api("/api/dashboard/proxy/safety/resume", { method: "POST" }).then(() => undefined), "Resumed.")}
              >
                Resume trading
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "skills" && (
        <div className="trading-dash-stack">
          <div className="panel">
            <h2 className="owner-settings-heading">Your skills</h2>
            {!state?.platformLinked ? (
              <p className="owner-settings-note">{SKILLS_BOT_ONLY_DISCLAIMER}</p>
            ) : null}
            <p className="owner-settings-note">
              Skills are instructions layered onto your Telegram/Discord assistant. <strong>rhagent core</strong> and{" "}
              <strong>Social posting</strong> are always on. Add built-ins, write your own, or import one from a URL /
              pasted markdown.
            </p>
            {!skills ? (
              <p className="owner-settings-note">Loading…</p>
            ) : (
              skills.active.map((s) => (
                <div key={s.id} className="trading-dash-row">
                  <div>
                    <div className="trading-dash-row-title">
                      {s.name} {s.owned ? <span className="muted">(yours)</span> : null}{" "}
                      {s.id === "rhagent-core" || s.id === "social-posting" ? (
                        <span className="muted">(mandatory)</span>
                      ) : null}
                    </div>
                    <div className="owner-settings-note">{s.description}</div>
                  </div>
                  <div className="trading-dash-actions">
                    <span className={`trading-dash-pill${s.enabled ? " trading-dash-pill--active" : ""}`}>
                      {s.enabled ? "on" : "off"}
                    </span>
                    {s.id !== "rhagent-core" && s.id !== "social-posting" ? (
                      <button
                        type="button"
                        className="btn btn-outline"
                        disabled={busy}
                        onClick={() =>
                          run(
                            () =>
                              api(`/api/dashboard/proxy/skills/${encodeURIComponent(s.id)}/${s.enabled ? "disable" : "enable"}`, {
                                method: "POST",
                              }).then(() => undefined),
                            s.enabled ? "Disabled." : "Enabled.",
                          )
                        }
                      >
                        {s.enabled ? "Turn off" : "Turn on"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={busy}
                      onClick={() =>
                        api(`/api/dashboard/proxy/skills/${encodeURIComponent(s.id)}/export`)
                          .then((r) => downloadMarkdown((r as { filename: string; markdown: string }).filename, (r as { markdown: string }).markdown))
                          .catch((err) => showToast(err instanceof Error ? err.message : "Failed", true))
                      }
                    >
                      Download
                    </button>
                    {s.id !== "rhagent-core" && s.id !== "social-posting" ? (
                      <button
                        type="button"
                        className="btn btn-outline"
                        disabled={busy}
                        onClick={() =>
                          run(
                            () => api(`/api/dashboard/proxy/skills/${encodeURIComponent(s.id)}`, { method: "DELETE" }).then(() => undefined),
                            s.owned ? "Deleted." : "Removed.",
                          )
                        }
                      >
                        {s.owned ? "Delete" : "Remove"}
                      </button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="panel">
            <h2 className="owner-settings-heading">Built-in catalog</h2>
            {!skills || !skills.catalog.length ? (
              <p className="owner-settings-note">No more built-ins to add — you have them all.</p>
            ) : (
              skills.catalog.map((s) => (
                <div key={s.id} className="trading-dash-row">
                  <div>
                    <div className="trading-dash-row-title">{s.name}</div>
                    <div className="owner-settings-note">{s.description}</div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () => api(`/api/dashboard/proxy/skills/${encodeURIComponent(s.id)}/enable`, { method: "POST" }).then(() => undefined),
                        "Added.",
                      )
                    }
                  >
                    Add
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="panel">
            <h2 className="owner-settings-heading">
              Write a custom skill{" "}
              {skills ? (
                <span className="trading-dash-pill">
                  {skills.active.filter((s) => s.owned).length}/{skills.maxCustom}
                </span>
              ) : null}
            </h2>
            <CreateSkillForm
              disabled={busy}
              onCreate={(payload) =>
                run(
                  () => api("/api/dashboard/proxy/skills", { method: "POST", body: JSON.stringify(payload) }).then(() => undefined),
                  "Skill created.",
                )
              }
            />
          </div>

          <div className="panel">
            <h2 className="owner-settings-heading">Import a skill</h2>
            <ImportSkillForm
              disabled={busy}
              onImport={(source) =>
                run(
                  () => api("/api/dashboard/proxy/skills/import", { method: "POST", body: JSON.stringify({ source }) }).then(() => undefined),
                  "Skill imported.",
                )
              }
            />
          </div>
        </div>
      )}

      {tab === "jobs" && (
        <div className="trading-dash-stack">
          <div className="panel">
            <h2 className="owner-settings-heading">
              Scheduled jobs{" "}
              <span className={`trading-dash-pill${atCap ? " trading-dash-pill--active" : ""}`}>
                {state.jobLimit.active}/{state.jobLimit.max} active
              </span>
            </h2>
            {!state?.platformLinked ? (
              <p className="owner-settings-note">{SKILLS_BOT_ONLY_DISCLAIMER}</p>
            ) : null}
            {!state.jobs.length ? (
              <p className="owner-settings-note">No jobs yet.</p>
            ) : (
              state.jobs.map((j) => {
                const schedule =
                  j.schedule_kind === "daily_utc" ? `daily ${j.at_utc_hhmm} UTC` : `every ${j.interval_minutes}m`;
                const trading = j.allow_trading
                  ? j.auto_execute
                    ? "can trade (autonomous)"
                    : "can trade (staged)"
                  : "read-only";
                return (
                  <div key={j.id} className="trading-dash-row">
                    <div>
                      <div className="trading-dash-row-title">
                        {j.label || j.prompt.slice(0, 50)} {!j.active ? <span className="muted">(inactive)</span> : null}
                      </div>
                      <div className="owner-settings-note">
                        {schedule} — {trading} — next: {j.next_run_at}
                        {j.last_error ? ` — last error: ${j.last_error.slice(0, 120)}` : ""}
                      </div>
                    </div>
                    {j.active ? (
                      <button
                        type="button"
                        className="btn btn-outline"
                        disabled={busy}
                        onClick={() =>
                          run(
                            () => api(`/api/dashboard/proxy/jobs/${encodeURIComponent(j.id)}`, { method: "DELETE" }).then(() => undefined),
                            "Job cancelled.",
                          )
                        }
                      >
                        Cancel
                      </button>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
          <div className="panel">
            <h2 className="owner-settings-heading">New job</h2>
            {atCap ? (
              <p className="trading-dash-notice">You&apos;re at the free-tier job limit — cancel one above to free a slot.</p>
            ) : null}
            <JobForm
              disabled={busy || atCap}
              onCreate={(payload) =>
                run(
                  () => api("/api/dashboard/proxy/jobs", { method: "POST", body: JSON.stringify(payload) }).then(() => undefined),
                  "Job created.",
                )
              }
            />
          </div>
        </div>
      )}

      {tab === "orders" && (
        <div className="panel">
          <h2 className="owner-settings-heading">Pending orders</h2>
          {!state.pendingOrders.length ? (
            <p className="owner-settings-note">No pending orders.</p>
          ) : (
            state.pendingOrders.map((o) => (
              <div key={o.id} className="trading-dash-row">
                <div>
                  <div className="trading-dash-row-title">{o.description}</div>
                  <div className="owner-settings-note">expires {o.expires_at}</div>
                </div>
                <div className="trading-dash-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () =>
                          api(`/api/dashboard/proxy/pending-orders/${encodeURIComponent(o.id)}/confirm`, {
                            method: "POST",
                          }).then(() => undefined),
                        "Confirmed.",
                      )
                    }
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () =>
                          api(`/api/dashboard/proxy/pending-orders/${encodeURIComponent(o.id)}/cancel`, {
                            method: "POST",
                          }).then(() => undefined),
                        "Cancelled.",
                      )
                    }
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "autotrade" && (
        <div className="trading-dash-stack">
          <div className="panel">
            <h2 className="owner-settings-heading">Autonomous execution</h2>
            <p className="owner-settings-note">
              When ON, trade-like calls from live chat and any job with auto_execute can self-execute instead of
              waiting for /confirm. Risk checks and the caps below still apply. /pause always stops everything.
            </p>
            {!state.autotrade.globalKillSwitchOn ? (
              <p className="trading-dash-notice">
                Autonomous trading is currently disabled platform-wide — this can&apos;t be turned on right now.
              </p>
            ) : null}
            <AutotradeControls
              enabled={state.autotrade.enabled}
              globalOn={!!state.autotrade.globalKillSwitchOn}
              busy={busy}
              onEnable={() =>
                run(
                  () =>
                    api("/api/dashboard/proxy/autotrade", {
                      method: "POST",
                      body: JSON.stringify({ enabled: true, acknowledgeRisk: true }),
                    }).then(() => undefined),
                  "Autonomous trading enabled.",
                )
              }
              onDisable={() =>
                run(
                  () =>
                    api("/api/dashboard/proxy/autotrade", {
                      method: "POST",
                      body: JSON.stringify({ enabled: false }),
                    }).then(() => undefined),
                  "Autonomous trading disabled.",
                )
              }
            />
          </div>
          <div className="panel">
            <h2 className="owner-settings-heading">Caps</h2>
            <AutotradeLimitsForm
              initial={state.autotrade}
              disabled={busy}
              onSave={(payload) =>
                run(
                  () => api("/api/dashboard/proxy/autotrade", { method: "POST", body: JSON.stringify(payload) }).then(() => undefined),
                  "Caps saved.",
                )
              }
            />
          </div>
        </div>
      )}

      {tab === "activity" && (
        <div className="panel">
          <h2 className="owner-settings-heading">Recent activity</h2>
          {!state.events.length ? (
            <p className="owner-settings-note">No activity yet.</p>
          ) : (
            state.events.map((e, i) => (
              <div key={i} className="trading-dash-row">
                <div className="owner-settings-note">{e.description}</div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "llm" && (
        <div className="trading-dash-stack">
          <div className="panel">
            <h2 className="owner-settings-heading">Assistant settings</h2>
            <LlmForm
              initial={state.llm}
              disabled={busy}
              onSave={(payload) =>
                run(
                  () => api("/api/dashboard/proxy/settings/llm", { method: "PATCH", body: JSON.stringify(payload) }).then(() => undefined),
                  "Saved.",
                )
              }
            />
          </div>
          <div className="panel">
            <h2 className="owner-settings-heading">Your LLM API key</h2>
            <p className="owner-settings-note">
              Write-only — never shown back here. Bring your own key so nothing is shared across users.
            </p>
            <LlmKeyForm
              disabled={busy}
              defaultProvider={state.llm.provider}
              onSave={(payload) =>
                run(
                  () => api("/api/dashboard/proxy/settings/llm-key", { method: "POST", body: JSON.stringify(payload) }).then(() => undefined),
                  "Key saved.",
                )
              }
            />
          </div>
        </div>
      )}

      {toast ? (
        <div className={`trading-dash-toast${toast.isError ? " is-error" : ""}`} role="status">
          {toast.msg}
        </div>
      ) : null}
    </div>
  );
}

function JobForm({
  disabled,
  onCreate,
}: {
  disabled: boolean;
  onCreate: (payload: Record<string, unknown>) => void;
}) {
  const [scheduleKind, setScheduleKind] = useState("interval_minutes");
  return (
    <form
      className="trading-dash-form"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        onCreate({
          label: fd.get("label") || null,
          prompt: fd.get("prompt"),
          scheduleKind: fd.get("scheduleKind"),
          intervalMinutes: Number(fd.get("intervalMinutes")) || undefined,
          atUtcHhmm: fd.get("atUtcHhmm") || undefined,
          allowTrading: fd.get("allowTrading") === "on",
          autoExecute: fd.get("autoExecute") === "on",
        });
        e.currentTarget.reset();
        setScheduleKind("interval_minutes");
      }}
    >
      <label>
        Label
        <input name="label" type="text" placeholder="Optional label" disabled={disabled} />
      </label>
      <label>
        Prompt
        <textarea name="prompt" rows={4} required placeholder="Instruction to run each time" disabled={disabled} />
      </label>
      <label>
        Schedule
        <select
          name="scheduleKind"
          value={scheduleKind}
          disabled={disabled}
          onChange={(e) => setScheduleKind(e.target.value)}
        >
          <option value="interval_minutes">Every N minutes</option>
          <option value="daily_utc">Daily at a UTC time</option>
        </select>
      </label>
      {scheduleKind === "interval_minutes" ? (
        <label>
          Interval minutes (min 5)
          <input name="intervalMinutes" type="number" min={5} defaultValue={60} disabled={disabled} />
        </label>
      ) : (
        <label>
          UTC time (HH:MM)
          <input name="atUtcHhmm" type="text" placeholder="13:30" disabled={disabled} />
        </label>
      )}
      <label className="trading-dash-check">
        <input name="allowTrading" type="checkbox" disabled={disabled} /> Allow this job to place/stage orders
      </label>
      <label className="trading-dash-check">
        <input name="autoExecute" type="checkbox" disabled={disabled} /> Let this job self-execute without /confirm
      </label>
      <button type="submit" className="btn btn-primary" disabled={disabled}>
        Create job
      </button>
    </form>
  );
}

function AutotradeControls({
  enabled,
  globalOn,
  busy,
  onEnable,
  onDisable,
}: {
  enabled: boolean;
  globalOn: boolean;
  busy: boolean;
  onEnable: () => void;
  onDisable: () => void;
}) {
  const [ack, setAck] = useState(false);
  return (
    <div className="trading-dash-stack-tight">
      <label className="trading-dash-check">
        <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> I understand trades may
        execute with no human confirmation, and I accept the risk.
      </label>
      <div className="trading-dash-actions">
        <button
          type="button"
          className="btn btn-outline"
          disabled={busy || !globalOn || enabled || !ack}
          onClick={onEnable}
        >
          Turn ON
        </button>
        <button type="button" className="btn btn-primary" disabled={busy || !enabled} onClick={onDisable}>
          Turn OFF
        </button>
        <span className={`trading-dash-pill${enabled ? " trading-dash-pill--active" : ""}`}>
          {enabled ? "ON" : "off"}
        </span>
      </div>
    </div>
  );
}

function AutotradeLimitsForm({
  initial,
  disabled,
  onSave,
}: {
  initial: DashboardState["autotrade"];
  disabled: boolean;
  onSave: (payload: Record<string, unknown>) => void;
}) {
  return (
    <form
      className="trading-dash-form"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        onSave({
          maxTradesPerDay: fd.get("maxTradesPerDay") ? Number(fd.get("maxTradesPerDay")) : undefined,
          maxOrderUsd: fd.get("maxOrderUsd") ? Number(fd.get("maxOrderUsd")) : null,
          maxConcurrentPositions: fd.get("maxConcurrentPositions")
            ? Number(fd.get("maxConcurrentPositions"))
            : undefined,
        });
      }}
    >
      <label>
        Max trades / day
        <input name="maxTradesPerDay" type="number" min={1} defaultValue={initial.max_trades_per_day} disabled={disabled} />
      </label>
      <label>
        Max $ per order (blank = platform default)
        <input
          name="maxOrderUsd"
          type="number"
          min={1}
          defaultValue={initial.max_order_usd ?? undefined}
          disabled={disabled}
        />
      </label>
      <label>
        Max concurrent positions
        <input
          name="maxConcurrentPositions"
          type="number"
          min={1}
          defaultValue={initial.max_concurrent_positions}
          disabled={disabled}
        />
      </label>
      <button type="submit" className="btn btn-primary" disabled={disabled}>
        Save caps
      </button>
    </form>
  );
}

function LlmForm({
  initial,
  disabled,
  onSave,
}: {
  initial: DashboardState["llm"];
  disabled: boolean;
  onSave: (payload: Record<string, unknown>) => void;
}) {
  return (
    <form
      className="trading-dash-form"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        onSave({
          provider: fd.get("provider"),
          model: fd.get("model") || null,
          persona: fd.get("persona") || null,
        });
      }}
    >
      <label>
        Provider
        <select name="provider" defaultValue={initial.provider || "anthropic"} disabled={disabled}>
          <option value="anthropic">Anthropic</option>
          <option value="openai">OpenAI</option>
          <option value="grok">Grok</option>
        </select>
      </label>
      <label>
        Model override (blank = default)
        <input name="model" type="text" defaultValue={initial.model ?? ""} disabled={disabled} />
      </label>
      <label>
        Persona / extra instructions
        <textarea name="persona" rows={6} defaultValue={initial.persona ?? ""} disabled={disabled} />
      </label>
      <button type="submit" className="btn btn-primary" disabled={disabled}>
        Save
      </button>
    </form>
  );
}

function LlmKeyForm({
  disabled,
  defaultProvider,
  onSave,
}: {
  disabled: boolean;
  defaultProvider: string;
  onSave: (payload: Record<string, unknown>) => void;
}) {
  return (
    <form
      className="trading-dash-form"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        onSave({ provider: fd.get("provider"), key: fd.get("key") });
        e.currentTarget.reset();
      }}
    >
      <label>
        Provider
        <select name="provider" defaultValue={defaultProvider || "anthropic"} disabled={disabled}>
          <option value="anthropic">Anthropic</option>
          <option value="openai">OpenAI</option>
          <option value="grok">Grok</option>
        </select>
      </label>
      <label>
        API key
        <input name="key" type="password" autoComplete="off" required disabled={disabled} />
      </label>
      <button type="submit" className="btn btn-primary" disabled={disabled}>
        Save key
      </button>
    </form>
  );
}

function downloadMarkdown(filename: string, markdown: string) {
  const blob = new Blob([markdown], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function CryptoConnectForm({
  pending,
  pendingPublicKey,
  connected,
  busy,
  onGenerate,
  onSaveKey,
  onPastePair,
  onDisconnect,
}: {
  pending: boolean;
  pendingPublicKey: string | null;
  connected: boolean;
  busy: boolean;
  onGenerate: () => Promise<string>;
  onSaveKey: (apiKey: string) => void;
  onPastePair: (apiKey: string, privateKeyBase64: string) => void;
  onDisconnect: () => void;
}) {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState(false);

  const displayPublicKey = publicKey ?? pendingPublicKey;
  const showFinishSteps = pending || Boolean(displayPublicKey);

  if (connected) {
    return (
      <div className="trading-dash-actions">
        <button type="button" className="btn btn-outline" disabled={busy} onClick={onDisconnect}>
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="trading-dash-stack-tight">
      <p className="owner-settings-note">{CRYPTO_CONNECT_INTRO}</p>

      {!showFinishSteps ? (
        <div className="trading-dash-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => onGenerate().then(setPublicKey).catch(() => undefined)}
          >
            Generate keypair
          </button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setAdvanced((v) => !v)}>
            {advanced ? "Hide" : "Paste an existing key pair instead"}
          </button>
        </div>
      ) : null}

      {showFinishSteps ? (
        <div className="setup-section" style={{ marginTop: 8 }}>
          {!pending ? (
            <Step n={1}>
              <p>
                <strong>Keypair generated.</strong> Private key is encrypted in this bot — never share it.
              </p>
            </Step>
          ) : null}
          <Step n={pending ? 1 : 2}>
            <p>
              On a <strong>desktop browser</strong> (Robinhood blocks mobile): open{" "}
              <strong>{RH_CRYPTO_API_PATH}</strong>.
            </p>
          </Step>
          <Step n={pending ? 2 : 3}>
            <p>
              Paste this <strong>public key</strong> into Robinhood (safe — cannot move funds):
            </p>
            {displayPublicKey ? <CopyBlock text={displayPublicKey} label="Copy public key" /> : null}
          </Step>
          <Step n={pending ? 3 : 4}>
            <p>
              Click Save in Robinhood. They show a key starting with <code>rh-api-…</code> — copy it from{" "}
              <em>their</em> page.
            </p>
            <p className="setup-note">{CRYPTO_PENDING_NOTE}</p>
          </Step>
          <Step n={pending ? 4 : 5}>
            <p>Paste the rh-api-… key below and click Save key.</p>
          </Step>
        </div>
      ) : null}

      {showFinishSteps ? (
        <form
          className="trading-dash-form"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            onSaveKey(String(fd.get("apiKey") || ""));
          }}
        >
          <label>
            rh-api-… key (from Robinhood after you save the public key)
            <input name="apiKey" type="text" placeholder="rh-api-..." required disabled={busy} autoComplete="off" />
          </label>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            Save key
          </button>
        </form>
      ) : null}

      {advanced ? (
        <form
          className="trading-dash-form"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            onPastePair(String(fd.get("apiKey") || ""), String(fd.get("privateKeyBase64") || ""));
            e.currentTarget.reset();
          }}
        >
          <p className="owner-settings-note muted">
            Already generated keys elsewhere? Paste both — skips the generate step above.
          </p>
          <label>
            rh-api-… key
            <input name="apiKey" type="text" placeholder="rh-api-..." required disabled={busy} autoComplete="off" />
          </label>
          <label>
            Private key (base64)
            <input name="privateKeyBase64" type="password" required disabled={busy} autoComplete="off" />
          </label>
          <button type="submit" className="btn btn-outline" disabled={busy}>
            Save pair
          </button>
        </form>
      ) : null}
    </div>
  );
}

function TokenConnectForm({
  connected,
  busy,
  placeholder,
  onSave,
  onDisconnect,
}: {
  connected: boolean;
  busy: boolean;
  placeholder: string;
  onSave: (value: string) => void;
  onDisconnect: () => void;
}) {
  if (connected) {
    return (
      <div className="trading-dash-actions">
        <button type="button" className="btn btn-outline" disabled={busy} onClick={onDisconnect}>
          Disconnect
        </button>
      </div>
    );
  }
  return (
    <form
      className="trading-dash-form"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        onSave(String(fd.get("value") || ""));
        e.currentTarget.reset();
      }}
    >
      <label>
        {placeholder}
        <input name="value" type="password" autoComplete="off" required disabled={busy} />
      </label>
      <button type="submit" className="btn btn-primary" disabled={busy}>
        Save
      </button>
    </form>
  );
}

function RhagentsRegisterForm({
  disabled,
  registrations,
  onRegister,
  onConfirm,
}: {
  disabled: boolean;
  registrations: RegistrationRow[];
  onRegister: (username: string, displayName: string) => void;
  onConfirm: (id: string) => void;
}) {
  return (
    <div className="trading-dash-stack-tight">
      <form
        className="trading-dash-form"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          onRegister(String(fd.get("username") || ""), String(fd.get("displayName") || ""));
        }}
      >
        <label>
          Username
          <input name="username" type="text" placeholder="ray_trades" required disabled={disabled} />
        </label>
        <label>
          Display name
          <input name="displayName" type="text" placeholder="Ray's Trading Agent" required disabled={disabled} />
        </label>
        <button type="submit" className="btn btn-outline" disabled={disabled}>
          Register on rhagent.bot
        </button>
      </form>
      {registrations.length ? (
        <div className="trading-dash-stack-tight">
          {registrations
            .filter((r) => r.status !== "completed" && r.status !== "cancelled" && r.status !== "expired")
            .map((r) => (
              <div key={r.id} className="trading-dash-row">
                <div className="owner-settings-note">{r.description}</div>
                <button type="button" className="btn btn-primary" disabled={disabled} onClick={() => onConfirm(r.id)}>
                  Continue
                </button>
              </div>
            ))}
        </div>
      ) : null}
    </div>
  );
}

function CreateSkillForm({
  disabled,
  onCreate,
}: {
  disabled: boolean;
  onCreate: (payload: Record<string, unknown>) => void;
}) {
  return (
    <form
      className="trading-dash-form"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        onCreate({
          name: fd.get("name"),
          description: fd.get("description") || null,
          body: fd.get("body"),
        });
        e.currentTarget.reset();
      }}
    >
      <label>
        Name
        <input name="name" type="text" required placeholder="Options basics" disabled={disabled} />
      </label>
      <label>
        Short description (optional)
        <input name="description" type="text" placeholder="One line summary" disabled={disabled} />
      </label>
      <label>
        Skill text
        <textarea name="body" rows={6} required placeholder="Instructions for your assistant…" disabled={disabled} />
      </label>
      <button type="submit" className="btn btn-primary" disabled={disabled}>
        Create skill
      </button>
    </form>
  );
}

function ImportSkillForm({ disabled, onImport }: { disabled: boolean; onImport: (source: string) => void }) {
  return (
    <form
      className="trading-dash-form"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        onImport(String(fd.get("source") || ""));
        e.currentTarget.reset();
      }}
    >
      <label>
        URL or pasted skill markdown
        <textarea
          name="source"
          rows={4}
          required
          placeholder="https://rhagent.bot/skill.md or paste a skill.md-style file"
          disabled={disabled}
        />
      </label>
      <button type="submit" className="btn btn-outline" disabled={disabled}>
        Import
      </button>
    </form>
  );
}
