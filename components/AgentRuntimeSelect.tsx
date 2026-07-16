"use client";

import {
  AGENT_GROUP_LABELS,
  AGENT_RUNTIME_OPTIONS,
  getAgentRuntimeOption,
  type AgentRuntimeId,
  type AgentRuntimeOption,
} from "@/lib/setup-agents";
import { CopyBlock } from "@/components/setup-ui";

const GROUPS: AgentRuntimeOption["group"][] = ["native", "our-setup", "bots"];

/** "Which agent are you?" — drives the Part C fork in SetupWizard. */
export function AgentRuntimeSelect({
  value,
  onChange,
  showCommands = true,
}: {
  value: AgentRuntimeId;
  onChange: (id: AgentRuntimeId) => void;
  /** When false, only the dropdown (used when Part A is replaced by bot steps). */
  showCommands?: boolean;
}) {
  const option = getAgentRuntimeOption(value);

  return (
    <div className="agent-runtime-select">
      <label className="agent-runtime-select-label" htmlFor="agent-runtime">
        Which agent are you using?
      </label>
      <select
        id="agent-runtime"
        className="agent-runtime-select-input"
        value={value}
        onChange={(e) => onChange(e.target.value as AgentRuntimeId)}
      >
        {GROUPS.map((group) => (
          <optgroup key={group} label={AGENT_GROUP_LABELS[group]}>
            {AGENT_RUNTIME_OPTIONS.filter((o) => o.group === group).map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {showCommands && option.commands.length > 0 ? (
        <div className="agent-runtime-select-panel">
          <p className="setup-note setup-note--flush">{option.intro}</p>
          {option.commands.map((cmd) => (
            <CopyBlock key={cmd.label} text={cmd.text} label={cmd.label} />
          ))}
          {option.note ? <p className="setup-note">{option.note}</p> : null}
        </div>
      ) : null}

      {showCommands && option.commands.length === 0 && option.note ? (
        <p className="setup-note">{option.note}</p>
      ) : null}
    </div>
  );
}
