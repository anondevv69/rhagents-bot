"use client";

export function TokenConnectForm({
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
