"use client";

import { useState } from "react";

export function JobForm({
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
