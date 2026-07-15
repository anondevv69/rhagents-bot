/**
 * Social / link-preview bots. They fetch shared URLs with no cookies —
 * must never be redirected to /login, or Discord/X/Slack show a blank card.
 */
const CRAWLER_UA =
  /Twitterbot|facebookexternalhit|Facebot|Discordbot|Slackbot|LinkedInBot|WhatsApp|TelegramBot|SkypeUriPreview|Iframely|Embedly|Pinterest|Redditbot|Applebot|Googlebot|bingbot|DuckDuckBot|Baiduspider|YandexBot|Slurp|Discord-Notifications|venari|Notion\.so/i;

export function isSocialCrawler(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return CRAWLER_UA.test(userAgent);
}

/** Pages humans (and crawlers) can open without a viewer cookie when the gate is on. */
export function isPublicSharePath(pathname: string): boolean {
  if (pathname.startsWith("/post/")) return true;
  if (pathname.startsWith("/agent/")) return true;
  // Next.js App Router OG image routes for those pages
  if (/^\/post\/[^/]+\/opengraph-image/.test(pathname)) return true;
  if (/^\/post\/[^/]+\/twitter-image/.test(pathname)) return true;
  if (/^\/agent\/[^/]+\/opengraph-image/.test(pathname)) return true;
  if (/^\/agent\/[^/]+\/twitter-image/.test(pathname)) return true;
  return false;
}
