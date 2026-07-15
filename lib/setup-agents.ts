/** "Which agent are you?" install paths for the Setup wizard Part A. */

import { RHAGENT_SKILL_INSTALL } from "@/lib/rhagent-setup";

export type AgentRuntimeId = "bankr" | "claude-code" | "cursor-codex-opencode" | "openclaw" | "other";

export interface AgentRuntimeCommand {
  text: string;
  label: string;
}

export interface AgentRuntimeOption {
  id: AgentRuntimeId;
  label: string;
  /** Shown above the command block(s). */
  intro: string;
  commands: AgentRuntimeCommand[];
  /** Extra note under the command(s), e.g. where to run it. */
  note?: string;
}

export const AGENT_RUNTIME_OPTIONS: AgentRuntimeOption[] = [
  {
    id: "bankr",
    label: "Bankr",
    intro: "Paste this into your Bankr chat:",
    commands: [{ text: RHAGENT_SKILL_INSTALL, label: "Copy for Bankr" }],
    note: "No plugin marketplace on Bankr — the skill installs straight from chat.",
  },
  {
    id: "claude-code",
    label: "Claude Code",
    intro: "Add the marketplace, then install the plugin:",
    commands: [
      {
        text: `claude plugin marketplace add rhagent69/claude-plugins
claude plugin install rhagent@rhagent-claude-plugins`,
        label: "Copy Claude Code install",
      },
    ],
  },
  {
    id: "cursor-codex-opencode",
    label: "Cursor / Codex / OpenCode",
    intro: "Run in your project:",
    commands: [
      { text: "bunx skills add rhagent69/claude-plugins --skill rhagents -y", label: "Copy skills.sh install" },
    ],
  },
  {
    id: "openclaw",
    label: "OpenClaw",
    intro: "Paste this into your OpenClaw chat:",
    commands: [{ text: RHAGENT_SKILL_INSTALL, label: "Copy for OpenClaw" }],
    note: "No plugin marketplace on OpenClaw — the skill installs straight from chat.",
  },
  {
    id: "other",
    label: "Other / custom agent",
    intro: "In any agent chat, paste:",
    commands: [{ text: RHAGENT_SKILL_INSTALL, label: "Copy install line" }],
    note: "Works anywhere your agent can read a GitHub URL and fetch files.",
  },
];

export function getAgentRuntimeOption(id: AgentRuntimeId): AgentRuntimeOption {
  return AGENT_RUNTIME_OPTIONS.find((o) => o.id === id) ?? AGENT_RUNTIME_OPTIONS[0];
}
