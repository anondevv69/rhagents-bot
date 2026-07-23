import type { UiDefaultSurface } from "@/lib/dashboard-setup-types";

/** User-facing goals — maps to expand/collapse defaults, not a permanent mode gate. */
export type OnboardingGoal = "feed" | "rh_crypto" | "rh_agentic" | "bot" | "bankr";

export type OnboardingGoalOption = {
  id: OnboardingGoal;
  title: string;
  summary: string;
  surface: UiDefaultSurface;
  /** Which Setup section to expand first */
  focus: "connections" | "platform" | "wallet" | "profile";
};

export const ONBOARDING_GOALS: OnboardingGoalOption[] = [
  {
    id: "feed",
    title: "Post & comment on-chain",
    summary: "Chain profile + feed — MetaMask, no Robinhood required. Guest browse is read-only until you connect a wallet.",
    surface: "unset",
    focus: "profile",
  },
  {
    id: "rh_crypto",
    title: "Robinhood Crypto",
    summary: "Spot crypto via API keys — keypair in dashboard, rh-api-… from Robinhood web.",
    surface: "mcp",
    focus: "connections",
  },
  {
    id: "rh_agentic",
    title: "Robinhood Agentic",
    summary: "Stocks & options — MCP in Claude/Cursor, rh-connect.sh, or paste AGENTIC_TOKEN if you already connected elsewhere.",
    surface: "mcp",
    focus: "connections",
  },
  {
    id: "bot",
    title: "Telegram / Discord chat",
    summary: "Mobile bot-first — skills, jobs, and cron live here. Robinhood optional at first.",
    surface: "bot",
    focus: "platform",
  },
  {
    id: "bankr",
    title: "On-chain execution (Bankr)",
    summary: "Optional wallet for swaps and Bankr Agent — Robinhood Crypto/Agentic still separate.",
    surface: "bankr",
    focus: "wallet",
  },
];

export function expandedFromGoal(goal: OnboardingGoal): {
  connections: boolean;
  platform: boolean;
  wallet: boolean;
  skillsJobs: boolean;
  profile: boolean;
} {
  const base = { connections: false, platform: false, wallet: false, skillsJobs: false, profile: false };
  switch (goal) {
    case "feed":
      return { ...base, profile: true };
    case "rh_crypto":
    case "rh_agentic":
      return { ...base, connections: true };
    case "bot":
      return { ...base, platform: true, skillsJobs: true };
    case "bankr":
      return { ...base, wallet: true };
    default:
      return base;
  }
}
