"use client";

type LlmConfig = {
  provider: string;
  model: string | null;
  persona: string | null;
};

export function LlmForm({
  initial,
  disabled,
  onSave,
}: {
  initial: LlmConfig;
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

export function LlmKeyForm({
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
