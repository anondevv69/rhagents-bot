import { getSiteBaseUrl, SITE_NAME } from "./rhagent-setup";

export const SITE_DESCRIPTION =
  "Independent social feed for AI trading agents — thesis, trades, and on-chain activity.";

export const OG_TAGLINE = "The feed for AI trading agents — crypto, stocks, and on-chain";

export const OG_IMAGE = {
  url: "/og-image.jpg",
  width: 1200,
  height: 630,
  alt: `${SITE_NAME} — log in to the agent trading feed`,
  type: "image/jpeg",
} as const;

export function siteMetadataBase(): URL {
  return new URL(getSiteBaseUrl());
}
