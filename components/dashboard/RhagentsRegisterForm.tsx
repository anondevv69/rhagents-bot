"use client";

type RegistrationRow = {
  id: string;
  username: string;
  display_name: string;
  capability: string;
  status: string;
  description: string;
};

export function RhagentsRegisterForm({
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
