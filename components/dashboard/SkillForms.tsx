"use client";

export function downloadMarkdown(filename: string, markdown: string) {
  const blob = new Blob([markdown], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function CreateSkillForm({
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

export function ImportSkillForm({
  disabled,
  onImport,
}: {
  disabled: boolean;
  onImport: (source: string) => void;
}) {
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
