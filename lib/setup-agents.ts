/** "Which agent are you?" — one fork drives Agentic connect; Crypto + register stay shared. */

import {
  CLIENTS_DOC_URL,
  RHAGENT_CLAUDE_PLUGIN_INSTALL,
  RHAGENT_SKILL_INSTALL,
  RHAGENT_SKILL_MD_URL,
  RHAGENT_SKILLS_SH_INSTALL,
} from "@/lib/rhagent-setup";

/**
 * How this runtime gets Robinhood Agentic (stocks & options).
 * - native: Robinhood's own Trading MCP (Claude / ChatGPT / Cursor / …)
 * - token: our localhost OAuth → AGENTIC_TOKEN (Bankr, OpenCode, headless, …)
 * - bots: our Telegram / Discord trading bots (same vault, no skill install required)
 */
export type AgenticPath = "native" | "token" | "bots";

export type AgentRuntimeId =
  | "claude-code"
  | "claude-desktop"
  | "chatgpt"
  | "cursor"
  | "codex"
  | "codex-cli"
  | "grok"
  | "other-mcp"
  | "bankr"
  | "opencode"
  | "openclaw"
  | "telegram"
  | "discord"
  | "other";

export interface AgentRuntimeCommand {
  text: string;
  label: string;
}

export interface AgentRuntimeOption {
  id: AgentRuntimeId;
  label: string;
  /** Group label in the dropdown (optgroup). */
  group: "native" | "our-setup" | "bots";
  agenticPath: AgenticPath;
  /** Shown above the command block(s) in Part A. */
  intro: string;
  commands: AgentRuntimeCommand[];
  note?: string;
  /** Click-path steps for Robinhood's native MCP (only when agenticPath === "native"). */
  nativeMcpSteps?: string[];
  /** Optional docs link for that client's MCP UI. */
  nativeDocsUrl?: string;
  nativeDocsLabel?: string;
}

const ROBINHOOD_MCP = "https://agent.robinhood.com/mcp/trading";
const RH_OVERVIEW =
  "https://robinhood.com/us/en/support/articles/agentic-trading-overview/";

export const AGENT_RUNTIME_OPTIONS: AgentRuntimeOption[] = [
  // ── Robinhood native MCP list ──────────────────────────────────────────────
  {
    id: "claude-code",
    label: "Claude Code",
    group: "native",
    agenticPath: "native",
    intro: "Add the marketplace, then install the plugin:",
    commands: [{ text: RHAGENT_CLAUDE_PLUGIN_INSTALL, label: "Copy Claude Code install" }],
    note: `If GitHub is down: ${RHAGENT_SKILL_INSTALL}`,
    nativeMcpSteps: [
      `Run in your terminal: claude mcp add robinhood-trading --transport http ${ROBINHOOD_MCP}`,
      "Enter /mcp in Claude Code",
      "Select robinhood-trading and authenticate → finish Agentic account onboarding on desktop",
    ],
    nativeDocsUrl: "https://docs.anthropic.com/en/docs/claude-code/mcp",
    nativeDocsLabel: "Claude Code MCP docs",
  },
  {
    id: "claude-desktop",
    label: "Claude Desktop",
    group: "native",
    agenticPath: "native",
    intro: "Paste into project instructions, or ask the agent to fetch the skill:",
    commands: [
      {
        text: "Read https://rhagent.bot/skill.md and help set up rhagent",
        label: "Copy for Claude Desktop",
      },
    ],
    note: "No GitHub plugin marketplace on Claude Desktop — skill loads from URL / instructions.",
    nativeMcpSteps: [
      "Go to Settings → Connectors → Add custom connector",
      `Paste MCP link: ${ROBINHOOD_MCP}`,
      "Authenticate → finish Agentic account onboarding on desktop",
    ],
    nativeDocsUrl: "https://support.anthropic.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp",
    nativeDocsLabel: "Claude Desktop connectors",
  },
  {
    id: "chatgpt",
    label: "ChatGPT",
    group: "native",
    agenticPath: "native",
    intro: "Add the skill URL to a Custom GPT / project instructions:",
    commands: [
      {
        text: "Read https://rhagent.bot/skill.md and help set up rhagent",
        label: "Copy for ChatGPT",
      },
    ],
    note: "No GitHub plugin marketplace on ChatGPT — skill loads from instructions.",
    nativeMcpSteps: [
      "Turn on Developer Mode",
      "Go to Settings → Apps → Create app",
      `Paste MCP link: ${ROBINHOOD_MCP}`,
      "Authenticate → finish Agentic account onboarding on desktop",
    ],
    nativeDocsUrl: "https://platform.openai.com/docs/guides/tools-remote-mcp",
    nativeDocsLabel: "ChatGPT / OpenAI MCP docs",
  },
  {
    id: "cursor",
    label: "Cursor",
    group: "native",
    agenticPath: "native",
    intro: "Run in your project:",
    commands: [{ text: RHAGENT_SKILLS_SH_INSTALL, label: "Copy Cursor install" }],
    note: `If GitHub is down: ${RHAGENT_SKILL_INSTALL}`,
    nativeMcpSteps: [
      `Give your agent this MCP link: ${ROBINHOOD_MCP}`,
      "Go to Settings → Cursor Settings",
      "Select Tools & MCPs → Connect → authenticate → finish Agentic account onboarding on desktop",
    ],
    nativeDocsUrl: "https://docs.cursor.com/context/model-context-protocol",
    nativeDocsLabel: "Cursor MCP docs",
  },
  {
    id: "codex",
    label: "Codex",
    group: "native",
    agenticPath: "native",
    intro: "Run in your project:",
    commands: [{ text: RHAGENT_SKILLS_SH_INSTALL, label: "Copy Codex install" }],
    nativeMcpSteps: [
      "Go to Settings → MCP servers",
      "Select Streamable HTTP",
      `Paste MCP link: ${ROBINHOOD_MCP}`,
      "Authenticate → finish Agentic account onboarding on desktop",
    ],
  },
  {
    id: "codex-cli",
    label: "Codex CLI",
    group: "native",
    agenticPath: "native",
    intro: "Run in your project (or use the Claude Code plugin install):",
    commands: [{ text: RHAGENT_SKILLS_SH_INSTALL, label: "Copy Codex CLI install" }],
    nativeMcpSteps: [
      `Run in your terminal: codex mcp add robinhood-trading --url ${ROBINHOOD_MCP}`,
      "Enter /mcp in Codex CLI",
      "Select robinhood-trading → finish Agentic account onboarding on desktop",
    ],
  },
  {
    id: "grok",
    label: "Grok",
    group: "native",
    agenticPath: "native",
    intro: "Paste into instructions, or ask Grok to fetch the skill:",
    commands: [
      {
        text: "Read https://rhagent.bot/skill.md and help set up rhagent",
        label: "Copy for Grok",
      },
    ],
    note: "No GitHub plugin marketplace on Grok — skill loads from instructions.",
    nativeMcpSteps: [
      "Start a chat → + → Add connector → Custom",
      `MCP link: ${ROBINHOOD_MCP}`,
      "Authenticate → finish Agentic account onboarding on desktop",
    ],
  },
  {
    id: "other-mcp",
    label: "Other MCP-capable agent",
    group: "native",
    agenticPath: "native",
    intro: "In any agent that supports MCP + can fetch a URL:",
    commands: [{ text: RHAGENT_SKILL_INSTALL, label: "Copy install line" }],
    note: `Full client table: ${CLIENTS_DOC_URL}`,
    nativeMcpSteps: [
      `Add Robinhood's Trading MCP: ${ROBINHOOD_MCP}`,
      "Authenticate in your platform → finish Agentic account onboarding on desktop",
      `Official steps: ${RH_OVERVIEW}`,
    ],
  },

  // ── Our setup (no native Robinhood MCP) ────────────────────────────────────
  {
    id: "bankr",
    label: "Bankr",
    group: "our-setup",
    agenticPath: "token",
    intro: "Paste this into your Bankr chat:",
    commands: [{ text: RHAGENT_SKILL_INSTALL, label: "Copy for Bankr" }],
    note: "No plugin marketplace on Bankr — paste the hosted skill URL. Agentic uses our OAuth script.",
  },
  {
    id: "opencode",
    label: "OpenCode",
    group: "our-setup",
    agenticPath: "token",
    intro: "Run in your project:",
    commands: [{ text: RHAGENT_SKILLS_SH_INSTALL, label: "Copy OpenCode install" }],
    note: "OpenCode is not on Robinhood's native MCP list — use our OAuth token flow for Agentic.",
  },
  {
    id: "openclaw",
    label: "OpenClaw / ClawdBot",
    group: "our-setup",
    agenticPath: "token",
    intro: "Paste this into your OpenClaw chat:",
    commands: [{ text: RHAGENT_SKILL_INSTALL, label: "Copy for OpenClaw" }],
    note: "No native Robinhood MCP — use our OAuth token flow for Agentic.",
  },
  {
    id: "other",
    label: "Other / headless / custom",
    group: "our-setup",
    agenticPath: "token",
    intro: "In any agent chat, paste:",
    commands: [{ text: RHAGENT_SKILL_INSTALL, label: "Copy install line" }],
    note: "If your runtime can't open a browser for Robinhood OAuth, use our token flow for Agentic.",
  },

  // ── Our Telegram / Discord trading bots ────────────────────────────────────
  {
    id: "telegram",
    label: "Telegram bot (rhagent)",
    group: "bots",
    agenticPath: "bots",
    intro: "No skill install — talk to the trading bot directly.",
    commands: [],
    note: "Same vault as Discord. Open the bot, then /start → connect Crypto and/or Agentic from chat.",
  },
  {
    id: "discord",
    label: "Discord bot (rhagent)",
    group: "bots",
    agenticPath: "bots",
    intro: "No skill install — add the trading bot to Discord.",
    commands: [],
    note: "Same vault as Telegram. Add the bot, then /start → connect Crypto and/or Agentic from slash commands.",
  },
];

export function getAgentRuntimeOption(id: AgentRuntimeId): AgentRuntimeOption {
  return (
    AGENT_RUNTIME_OPTIONS.find((o) => o.id === id) ??
    AGENT_RUNTIME_OPTIONS.find((o) => o.id === "claude-code")!
  );
}

export const AGENT_GROUP_LABELS: Record<AgentRuntimeOption["group"], string> = {
  native: "Robinhood native MCP (stocks & options)",
  "our-setup": "Bankr / OpenCode / headless (our OAuth)",
  bots: "Our Telegram or Discord bot",
};

export const ROBINHOOD_MCP_URL = ROBINHOOD_MCP;
export const ROBINHOOD_AGENTIC_OVERVIEW_URL = RH_OVERVIEW;
export const ROBINHOOD_TRADING_WITH_AGENT_URL =
  "https://robinhood.com/us/en/support/articles/trading-with-your-agent/";

/** Plain-language product cards for the setup wizard. */
export const PRODUCT_AGENTIC = {
  title: "Robinhood app · Agentic",
  summary:
    "Stocks & options in your Robinhood Agentic account — the same account in the Robinhood app. Quotes, portfolio, orders, option chains, scans.",
  examples: "e.g. SPCX, NVDA, AAPL calls — settle in the Robinhood app.",
};

export const PRODUCT_CRYPTO = {
  title: "Robinhood app · Crypto",
  summary:
    "BTC, DOGE, ETH, and other listed pairs in your Robinhood Crypto account — same Robinhood app, separate product from Agentic. Native Trading MCP does not cover crypto.",
  examples: "e.g. BTC-USD, DOGE-USD, ETH-USD — settle in the Robinhood app.",
};

export type VerifyProduct = "agentic" | "crypto" | "both";
