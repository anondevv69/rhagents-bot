"use client";

import { useState } from "react";

type AutotradeState = {
  enabled: boolean;
  max_trades_per_day: number;
  max_order_usd: number | null;
  max_concurrent_positions: number;
};

export function AutotradeControls({
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

export function AutotradeLimitsForm({
  initial,
  disabled,
  onSave,
}: {
  initial: AutotradeState;
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
