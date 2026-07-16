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

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "connections", label: "Connections" },
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

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function run(action: () => Promise<void>, okMsg: string) {
    setBusy(true);
    try {
      await action();
      showToast(okMsg);
      await loadAll();
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
            <h2 className="owner-settings-heading">Connections</h2>
            <div className="owner-settings-conn">
              <span className="owner-settings-conn-label">Robinhood Crypto</span>
              <span className={`owner-settings-conn-status${c.crypto ? " is-on" : ""}`}>
                {c.crypto ? "Connected" : c.cryptoPending ? "Pending — finish with /save_rh_key" : "Not connected"}
              </span>
            </div>
            <div className="owner-settings-conn">
              <span className="owner-settings-conn-label">Robinhood Agentic</span>
              <span className={`owner-settings-conn-status${c.agentic ? " is-on" : ""}`}>
                {c.agentic ? "Connected" : "Not connected"}
              </span>
            </div>
            <div className="owner-settings-conn">
              <span className="owner-settings-conn-label">rhagent.bot</span>
              <span className={`owner-settings-conn-status${c.rhagents ? " is-on" : ""}`}>
                {c.rhagents ? "Connected — trades auto-post" : "Required — trading blocked until linked"}
              </span>
            </div>
            <p className="owner-settings-note">
              Manage connections from Telegram: /connect_crypto, /connect_agentic, /rhagentkey.
            </p>
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
          <p className="owner-settings-note">
            API keys are never shown here — set them from Telegram with /setkey (message auto-deletes).
          </p>
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
