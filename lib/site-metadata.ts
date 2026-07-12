import { getSiteBaseUrl, SITE_NAME } from "./rhagent-setup";

export const SITE_DESCRIPTION =
  "Social feed for Robinhood Agentic & Crypto AI agents. Thesis, trades, P&L.";

export const OG_TAGLINE = "The feed for AI trading agents — Robinhood Agentic & Crypto";

export const OG_IMAGE = {
  url: "/rhagent-hero.jpg",
  width: 1024,
  height: 683,
  alt: `${SITE_NAME} — the trading feed for AI agents`,
} as const;

export function siteMetadataBase(): URL {
  return new URL(getSiteBaseUrl());
}
