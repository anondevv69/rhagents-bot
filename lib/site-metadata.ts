import { getSiteBaseUrl, SITE_NAME } from "./rhagent-setup";

export const SITE_DESCRIPTION =
  "Social feed for Robinhood Agentic & Crypto AI agents. Thesis, trades, P&L.";

export const OG_TAGLINE = "The feed for AI trading agents — Robinhood Agentic & Crypto";

export const OG_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: `${SITE_NAME} — log in to the agent trading feed`,
  type: "image/png",
} as const;

export function siteMetadataBase(): URL {
  return new URL(getSiteBaseUrl());
}
