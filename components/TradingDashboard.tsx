"use client";

import { useCallback, useEffect, useState } from "react";

type DashboardState = {
  telegramId: string;
  connections: {
    crypto: boolean;
    cryptoPending?: boolean;
    agentic: boolean;
    rhagents: boolean;
  };
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

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "connections", label: "Connections" },
  { id: "skills", label: "Skills" },
  { id: "jobs", label: "Jobs" },
  { id: "orders", label: "Pending orders" },
  { id: "autotrade", label: "Autotrade" },
  { id: "activity", label: "Activity" },
  { id: "llm", label: "Assistant" },
] as const;

type TabId = (typeof TABS)[number]["id"];

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

export function TradingDashboard() {
  const [state, setState] = useState<DashboardState | null>(null);
  const [skills, setSkills] = useState<SkillsState | null>(null);
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([]);
  const [tab, setTab] = useState<TabId>("overview");
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
      setError(null);
    } catch (err) {
      setState(null);
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, []);

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

  useEffect(() => {
    void loadAll();
    void loadSkills();
    void loadRegistrations();
  }, [loadAll, loadSkills, loadRegistrations]);

  async function run(action: () => Promise<void>, okMsg: string) {
    setBusy(true);
    try {
      await action();
      showToast(okMsg);
      await Promise.all([loadAll(), loadSkills(), loadRegistrations()]);
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
          <p className="owner-settings-note">
            Send <code>/website</code> in Telegram or Discord for a fresh login link.
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

  return (
    <div className="trading-dash">
      <header className="trading-dash-header">
        <div>
          <h1 className="page-header-title">Trading dashboard</h1>
          <p className="page-header-subtitle">Manage your trading agent (Telegram or Discord) on rhagent.bot</p>
        </div>
        <div className="trading-dash-header-actions">
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

      <nav className="trading-dash-tabs" aria-label="Dashboard sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`trading-dash-tab${tab === t.id ? " is-active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="trading-dash-grid">
          {[
            ["Crypto", c.crypto ? "connected" : c.cryptoPending ? "pending" : "not connected"],
            ["Agentic", c.agentic ? "connected" : "not connected"],
            ["rhagent.bot", c.rhagents ? "connected" : "required"],
            ["Trading state", state.trading.state],
            ["Autotrade", state.autotrade.enabled ? "ON" : "off"],
            ["Active jobs", `${state.jobLimit.active}/${state.jobLimit.max}`],
            ["Pending orders", String(state.pendingOrders.length)],
            ["LLM provider", state.llm.provider],
          ].map(([label, value]) => (
            <div key={label} className="panel trading-dash-stat">
              <div className="panel-label">{label}</div>
              <div className="trading-dash-stat-value">{value}</div>
            </div>
          ))}
        </div>
      )}

      {tab === "connections" && (
        <div className="trading-dash-stack">
          <div className="panel">
            <h2 className="owner-settings-heading">Robinhood Crypto</h2>
            <div className="owner-settings-conn">
              <span className="owner-settings-conn-label">Status</span>
              <span className={`owner-settings-conn-status${c.crypto ? " is-on" : ""}`}>
                {c.crypto ? "Connected" : c.cryptoPending ? "Pending — paste the rh-api-... key below" : "Not connected"}
              </span>
            </div>
            <CryptoConnectForm
              pending={!!c.cryptoPending}
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
            <p className="owner-settings-note">
              Robinhood requires OAuth on a desktop browser or an MCP client — that step can&apos;t be skipped. Once
              you have a token (from the desktop Connect app, a direct MCP client, or the setup wizard), paste it
              below.
            </p>
            <TokenConnectForm
              connected={c.agentic}
              busy={busy}
              placeholder="Agentic token"
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
                  Either paste an existing agent key, or register a brand-new rhagent.bot profile (small ~$0.10
                  ownership-verification trade, needs Crypto or Agentic connected above first).
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
            <p className="owner-settings-note">
              Skills are instructions layered onto your assistant. <strong>rhagent core</strong> is always on. Add
              built-ins, write your own, or import one from a URL / pasted markdown.
            </p>
            {!skills ? (
              <p className="owner-settings-note">Loading…</p>
            ) : (
              skills.active.map((s) => (
                <div key={s.id} className="trading-dash-row">
                  <div>
                    <div className="trading-dash-row-title">
                      {s.name} {s.owned ? <span className="muted">(yours)</span> : null}{" "}
                      {s.id === "rhagent-core" ? <span className="muted">(mandatory)</span> : null}
                    </div>
                    <div className="owner-settings-note">{s.description}</div>
                  </div>
                  <div className="trading-dash-actions">
                    <span className={`trading-dash-pill${s.enabled ? " trading-dash-pill--active" : ""}`}>
                      {s.enabled ? "on" : "off"}
                    </span>
                    {s.id !== "rhagent-core" ? (
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
                    {s.id !== "rhagent-core" ? (
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
  connected,
  busy,
  onGenerate,
  onSaveKey,
  onPastePair,
  onDisconnect,
}: {
  pending: boolean;
  connected: boolean;
  busy: boolean;
  onGenerate: () => Promise<string>;
  onSaveKey: (apiKey: string) => void;
  onPastePair: (apiKey: string, privateKeyBase64: string) => void;
  onDisconnect: () => void;
}) {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState(false);

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
      {!pending ? (
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
      {publicKey || pending ? (
        <div className="owner-settings-note">
          {publicKey ? (
            <>
              Public key (paste into Robinhood → Account → Settings → Crypto → API Trading → + Add key):
              <br />
              <code>{publicKey}</code>
            </>
          ) : (
            "Keypair already generated — paste the rh-api-... key Robinhood gave you below."
          )}
        </div>
      ) : null}
      {pending || publicKey ? (
        <form
          className="trading-dash-form"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            onSaveKey(String(fd.get("apiKey") || ""));
          }}
        >
          <label>
            rh-api-... key
            <input name="apiKey" type="text" placeholder="rh-api-..." required disabled={busy} />
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
          <label>
            rh-api-... key
            <input name="apiKey" type="text" placeholder="rh-api-..." required disabled={busy} />
          </label>
          <label>
            Private key (base64)
            <input name="privateKeyBase64" type="password" required disabled={busy} />
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
