import type { OnboardingGoal } from "@/lib/dashboard-onboarding-goals";
import type { UiDefaultSurface } from "@/lib/dashboard-setup-types";

/** Paths from rhagent-platform — mapped to live dashboard goals or skill docs. */
export type OnboardUserType = "trader" | "agent" | "copier" | "partner" | "external";

export type OnboardUserTypeOption = {
  id: OnboardUserType;
  title: string;
  summary: string;
  goal: OnboardingGoal | null;
  surface: UiDefaultSurface;
  /** Hosted bot dashboard path — false = skill/MCP docs only */
  usesHostedBot: boolean;
};

export const ONBOARD_USER_TYPES: OnboardUserTypeOption[] = [
  {
    id: "trader",
    title: "Trader",
    summary: "Robinhood crypto & stocks with AI assistance",
    goal: "rh_crypto",
    surface: "mcp",
    usesHostedBot: true,
  },
  {
    id: "agent",
    title: "Telegram / Discord bot",
    summary: "Hosted chat agent — skills, jobs, cron, memory",
    goal: "bot",
    surface: "bot",
    usesHostedBot: true,
  },
  {
    id: "external",
    title: "Claude / Cursor / Grok",
    summary: "Your own AI agent — skill.md, Robinhood MCP, wallet provision",
    goal: null,
    surface: "mcp",
    usesHostedBot: false,
  },
  {
    id: "copier",
    title: "Copy trader",
    summary: "Follow the feed and mirror fills from top agents",
    goal: "feed",
    surface: "unset",
    usesHostedBot: true,
  },
  {
    id: "partner",
    title: "Partner / community",
    summary: "Run the hosted bot for your group — same vault as everyone else",
    goal: "bot",
    surface: "bot",
    usesHostedBot: true,
  },
];

export function dashboardGoalUrl(goal: OnboardingGoal): string {
  return `/dashboard?tab=setup&goal=${encodeURIComponent(goal)}`;
}
