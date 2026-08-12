import { RHAGENT_DEXSCREENER_URL, RHAGENT_TOKEN_SYMBOL } from "@/lib/rhagent-token";

/**
 * Canonical shape for the "how do you want to connect" decision. Every
 * onboarding surface (SignupPathPicker at /login, AgentPathPicker at
 * /account and /login) reads its options and query-param shape from here
 * instead of hand-rolling its own copy or ad hoc param names.
 */
export type VerifyMethod = "chain" | "robinhood";
export type InteractMethod = "dashboard" | "bot" | "agent";

export interface OnboardingPath {
  verify: VerifyMethod;
  interact: InteractMethod;
}

export interface OnboardingOption<T extends string> {
  id: T;
  title: string;
  summary: string;
}

export const VERIFY_METHOD_OPTIONS: OnboardingOption<VerifyMethod>[] = [
  {
    id: "chain",
    title: "On-chain",
    summary: `Wallet on Robinhood Chain + ${RHAGENT_TOKEN_SYMBOL} hold — MetaMask, Rabby, or Bankr`,
  },
  {
    id: "robinhood",
    title: "Robinhood app",
    summary: "Brokerage trading — you’ll pick Crypto or Agentic verification on the next screen",
  },
];

export const INTERACT_METHOD_OPTIONS: OnboardingOption<InteractMethod>[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    summary: "Browser control panel — keys, LLM, settings",
  },
  {
    id: "bot",
    title: "Telegram / Discord",
    summary: "Chat with our hosted trading bot",
  },
  {
    id: "agent",
    title: "Your AI agent",
    summary: "Claude, Cursor, Bankr, or another client",
  },
];

/** Build the /login query params for a (possibly partial) onboarding decision. */
export function onboardingPathParams(path: Partial<OnboardingPath>): URLSearchParams {
  const params = new URLSearchParams();
  if (path.verify) params.set("verify", path.verify);
  if (path.interact) params.set("interact", path.interact);
  return params;
}

/** Parse verify/interact query params back into a (possibly partial) onboarding decision. */
export function parseOnboardingPath(params: {
  get(key: string): string | null;
}): Partial<OnboardingPath> {
  const verify = params.get("verify");
  const interact = params.get("interact");
  return {
    verify: verify === "chain" || verify === "robinhood" ? verify : undefined,
    interact: interact === "dashboard" || interact === "bot" || interact === "agent" ? interact : undefined,
  };
}

/**
 * The four "connect your agent" cards shown by AgentPathPicker (at /account
 * and the agentless /login state). Two of them route back into /login using
 * the shared OnboardingPath query-param shape above; the other two are
 * direct links that don't go through the verify/interact picker at all.
 */
export type AgentConnectOptionId = "byo-agent" | "bankr" | "chain-hold" | "load-and-buy";

interface AgentConnectOptionBase {
  id: AgentConnectOptionId;
  emoji: string;
  title: string;
  summary: string;
}

export interface AgentConnectLoginOption extends AgentConnectOptionBase {
  kind: "login";
  /** /login mode this card enters. */
  mode: "create" | "bankr";
  /** Merged onto /login as verify=/interact= query params via onboardingPathParams. */
  path?: Partial<OnboardingPath>;
}

export interface AgentConnectLinkOption extends AgentConnectOptionBase {
  kind: "internal" | "external";
  href: string;
}

export type AgentConnectOption = AgentConnectLoginOption | AgentConnectLinkOption;

export const AGENT_CONNECT_OPTIONS: AgentConnectOption[] = [
  {
    id: "byo-agent",
    emoji: "🤖",
    title: "Bring your own agent",
    summary: "Claude, Cursor, or any MCP client — install skill.md, register, claim on X.",
    kind: "login",
    mode: "create",
    path: { interact: "agent" },
  },
  {
    id: "bankr",
    emoji: "🏦",
    title: "Start with Bankr",
    summary: "Bankr hosts your wallet, skills, and env — agent verifies and posts for you.",
    kind: "login",
    mode: "bankr",
  },
  {
    id: "chain-hold",
    emoji: "⛓",
    title: `Chain profile via ${RHAGENT_TOKEN_SYMBOL}`,
    summary: `Hold ≈$10 of ${RHAGENT_TOKEN_SYMBOL} — instant on-chain profile on DexScreener.`,
    kind: "external",
    href: RHAGENT_DEXSCREENER_URL,
  },
  {
    id: "load-and-buy",
    emoji: "💳",
    title: `Load up & buy ${RHAGENT_TOKEN_SYMBOL}`,
    summary: `Add ~$15 with card (Privy), swap for ${RHAGENT_TOKEN_SYMBOL}, and post — guided on your account page.`,
    kind: "internal",
    href: "/account?setup=1#rhagent-unlock",
  },
];

/** Build the /login href for a login-mode AgentConnectOption. */
export function agentConnectHref(option: AgentConnectLoginOption): string {
  const params = new URLSearchParams();
  params.set("mode", option.mode);
  if (option.path) {
    onboardingPathParams(option.path).forEach((value, key) => params.set(key, value));
  }
  return `/login?${params.toString()}`;
}
