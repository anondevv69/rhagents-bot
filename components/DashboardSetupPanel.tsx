"use client";

import type { SetupProgress } from "@/lib/dashboard-setup-types";
import { DashboardConnectPanel } from "@/components/DashboardConnectPanel";

type Props = {
  setup: SetupProgress;
  platformLinked?: boolean;
  chatEngine?: string;
  managedInferenceLine?: string | null;
  busy?: boolean;
  onBootstrap?: () => Promise<void>;
  onGoConnections?: () => void;
  onGoSkills?: () => void;
  onGoJobs?: () => void;
  botDeepLink?: string | null;
  onRefresh?: () => void;
};

export function DashboardSetupPanel({
  setup,
  platformLinked,
  chatEngine,
  managedInferenceLine,
  busy,
  onBootstrap,
  onGoConnections,
  onGoSkills,
  onGoJobs,
  botDeepLink,
  onRefresh,
}: Props) {
  const doneCount = setup.steps.filter((s) => s.done).length;

  return (
    <div className="panel trading-dash-setup">
      <div className="panel-header-row">
        <div>
          <h2 className="owner-settings-heading" style={{ marginBottom: 4 }}>
            Setup
          </h2>
          <p className="owner-settings-note muted">
            {setup.complete
              ? "Core setup complete — use Skills, Jobs, and chat freely."
              : `${doneCount}/${setup.steps.length} steps done — finish here instead of memorizing bot commands.`}
          </p>
        </div>
        {!setup.bankr && onBootstrap ? (
          <button type="button" className="btn btn-outline" disabled={busy} onClick={() => void onBootstrap()}>
            {busy ? "Working…" : "Initialize wallet"}
          </button>
        ) : null}
      </div>

      <ol className="trading-dash-setup-steps">
        {setup.steps.map((step) => (
          <li key={step.id} className={`trading-dash-setup-step${step.done ? " is-done" : ""}`}>
            <span className="trading-dash-setup-check">{step.done ? "✓" : "○"}</span>
            <div>
              <strong>{step.label}</strong>
              {step.hint && !step.done ? <p className="owner-settings-note muted">{step.hint}</p> : null}
            </div>
          </li>
        ))}
      </ol>

      {(chatEngine || managedInferenceLine) && (
        <p className="owner-settings-note" style={{ marginTop: 12 }}>
          Chat engine: <code className="docs-code-inline">{chatEngine ?? "—"}</code>
          {managedInferenceLine ? <> · {managedInferenceLine}</> : null}
        </p>
      )}

      {setup.bankrWalletAddress ? (
        <p className="owner-settings-note muted">
          Crypto wallet: <code className="docs-code-inline">{setup.bankrWalletAddress}</code>
        </p>
      ) : null}

      <div className="trading-dash-setup-actions" style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 8 }}>
        {!setup.robinhood && onGoConnections ? (
          <button type="button" className="btn btn-primary" onClick={onGoConnections}>
            Connect Robinhood
          </button>
        ) : null}
        {setup.robinhood && !setup.rhagents && onGoConnections ? (
          <button type="button" className="btn btn-outline" onClick={onGoConnections}>
            Create rhagent.bot profile
          </button>
        ) : null}
        {onGoSkills ? (
          <button type="button" className="btn btn-outline" onClick={onGoSkills}>
            Skills
          </button>
        ) : null}
        {onGoJobs ? (
          <button type="button" className="btn btn-outline" onClick={onGoJobs}>
            Jobs
          </button>
        ) : null}
        {botDeepLink ? (
          <a href={botDeepLink} className="btn btn-outline" target="_blank" rel="noreferrer">
            Open Telegram bot
          </a>
        ) : null}
      </div>

      {!platformLinked ? (
        <DashboardConnectPanel platformLinked={platformLinked} onConnected={onRefresh} />
      ) : null}

      {!setup.platformLinked && botDeepLink ? (
        <p className="owner-settings-note" style={{ marginTop: 12 }}>
          Jobs and some registration flows need one message to the bot first — tap{" "}
          <strong>Open Telegram bot</strong> and send <code className="docs-code-inline">/start</code>, then refresh
          this page.
        </p>
      ) : null}
    </div>
  );
}
