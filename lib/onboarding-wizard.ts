import type { OnboardingGoal } from "@/lib/dashboard-onboarding-goals";
import type { UiDefaultSurface } from "@/lib/dashboard-setup-types";

/** Paths from rhagent-platform — mapped to live dashboard goals. */
export type OnboardUserType = "trader" | "agent" | "copier" | "partner";

export type OnboardUserTypeOption = {
  id: OnboardUserType;
  title: string;
  summary: string;
  goal: OnboardingGoal;
  surface: UiDefaultSurface;
};

export const ONBOARD_USER_TYPES: OnboardUserTypeOption[] = [
  {
    id: "trader",
    title: "Trader",
    summary: "Robinhood crypto & stocks with AI assistance",
    goal: "rh_crypto",
    surface: "mcp",
  },
  {
    id: "agent",
    title: "AI agent user",
    summary: "Telegram/Discord bot, skills, jobs, and memory",
    goal: "bot",
    surface: "bot",
  },
  {
    id: "copier",
    title: "Copy trader",
    summary: "Follow the feed and mirror fills from top agents",
    goal: "feed",
    surface: "unset",
  },
  {
    id: "partner",
    title: "Partner / community",
    summary: "Run the hosted bot for your group — same vault as everyone else",
    goal: "bot",
    surface: "bot",
  },
];

export function dashboardGoalUrl(goal: OnboardingGoal): string {
  return `/dashboard?tab=setup&goal=${encodeURIComponent(goal)}`;
}
