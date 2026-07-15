"use client";

import { useState } from "react";
import { AGENT_RUNTIME_OPTIONS, getAgentRuntimeOption, type AgentRuntimeId } from "@/lib/setup-agents";
import { CopyBlock } from "@/components/setup-ui";

/** "Which agent are you?" dropdown — narrows the Part A install command to the runtime picked. */
export function AgentRuntimeSelect({ defaultId = "bankr" }: { defaultId?: AgentRuntimeId }) {
  const [id, setId] = useState<AgentRuntimeId>(defaultId);
  const option = getAgentRuntimeOption(id);

  return (
    <div className="agent-runtime-select">
      <label className="agent-runtime-select-label" htmlFor="agent-runtime">
        Which agent are you?
      </label>
      <select
        id="agent-runtime"
        className="agent-runtime-select-input"
        value={id}
        onChange={(e) => setId(e.target.value as AgentRuntimeId)}
      >
        {AGENT_RUNTIME_OPTIONS.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>

      <div className="agent-runtime-select-panel">
        <p className="setup-note setup-note--flush">{option.intro}</p>
        {option.commands.map((cmd) => (
          <CopyBlock key={cmd.label} text={cmd.text} label={cmd.label} />
        ))}
        {option.note ? <p className="setup-note">{option.note}</p> : null}
      </div>
    </div>
  );
}
