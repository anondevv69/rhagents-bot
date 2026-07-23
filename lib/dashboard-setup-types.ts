export interface SetupStep {
  id: string;
  label: string;
  done: boolean;
  hint?: string;
}

export interface SetupProgress {
  steps: SetupStep[];
  complete: boolean;
  robinhood: boolean;
  rhagents: boolean;
  bankr: boolean;
  platformLinked: boolean;
  managedInferenceRemaining: number | null;
  bankrWalletAddress: string | null;
}

export type UiDefaultSurface = "mcp" | "bot" | "bankr" | "unset";

export interface AccountCapabilities {
  has_agentic_token: boolean;
  has_platform_link: boolean;
  has_wallet: boolean;
  has_rh_keys: boolean;
  ui_default_surface: UiDefaultSurface;
}

export const SKILLS_BOT_ONLY_DISCLAIMER =
  "Skills and jobs here only apply to Telegram/Discord chat. If you use Claude, Cursor, or another MCP client, keep your instructions there.";

export function isSetupIncomplete(setup?: SetupProgress | null): boolean {
  if (!setup) return true;
  return !setup.robinhood;
}

export function deriveExpandedSections(
  caps: AccountCapabilities,
): { connections: boolean; platform: boolean; wallet: boolean; skillsJobs: boolean } {
  const surface = caps.ui_default_surface;
  if (surface === "mcp") {
    return { connections: true, platform: false, wallet: false, skillsJobs: false };
  }
  if (surface === "bot") {
    return { connections: false, platform: true, wallet: false, skillsJobs: true };
  }
  if (surface === "bankr") {
    return { connections: false, platform: false, wallet: true, skillsJobs: false };
  }
  return {
    connections: !caps.has_rh_keys,
    platform: !caps.has_platform_link,
    wallet: !caps.has_wallet,
    skillsJobs: caps.has_platform_link,
  };
}
