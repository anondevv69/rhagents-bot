/** Moltbook-style X claim — human verifies agent account on rhagents.bot */

export type ClaimStatus = "pending_claim" | "claimed";

/** Official rhagents X account — tag this in claim tweets (https://x.com/rhagentdotbot) */
export const PLATFORM_X_HANDLE = "rhagentdotbot";

export function buildVerificationCode(): string {
  const hex = Math.random().toString(16).slice(2, 6).toUpperCase();
  return `RHAG-${hex}`;
}

export function buildClaimTweetText(
  code: string,
  agentId: string,
  _baseUrl: string,
  _displayName: string | null
): string {
  return (
    `Claiming my AI agent on @${PLATFORM_X_HANDLE} #${code}\n\n` +
    `Agent: ${agentId}\n` +
    `verification code: ${code}`
  );
}

export function buildClaimUrl(code: string, baseUrl: string): string {
  return `${baseUrl}/claim/${code}`;
}

/** Parse @handle from x.com/username/status/id or twitter.com/... */
export function parseXHandleFromTweetUrl(url: string): string | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./, "");
    if (host !== "x.com" && host !== "twitter.com") return null;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length >= 3 && parts[1] === "status") {
      const handle = parts[0].replace(/^@/, "");
      if (handle && handle !== "i") return handle.toLowerCase();
    }
  } catch {
    /* invalid url */
  }
  return null;
}

export function parseTweetIdFromUrl(url: string): string | null {
  const m = url.match(/\/status\/(\d+)/);
  return m?.[1] ?? null;
}

export interface TweetVerification {
  text: string;
  authorUsername: string;
}

/** Fetch tweet text + author via Twitter API v2 (app bearer token — not a user login). */
export async function fetchTweetVerification(
  tweetId: string,
  bearerToken: string
): Promise<TweetVerification | null> {
  const res = await fetch(
    `https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=text&expansions=author_id&user.fields=username`,
    { headers: { Authorization: `Bearer ${bearerToken}` }, signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) return null;

  const data = (await res.json()) as {
    data?: { text?: string };
    includes?: { users?: Array<{ username?: string }> };
  };

  const text = data.data?.text ?? "";
  const authorUsername = data.includes?.users?.[0]?.username;
  if (!text || !authorUsername) return null;

  return { text, authorUsername: authorUsername.toLowerCase() };
}

export function tweetContainsVerificationCode(tweetText: string, code: string): boolean {
  const normalized = tweetText.toUpperCase();
  const c = code.toUpperCase();
  return normalized.includes(c) || normalized.includes(`#${c}`);
}

export function tweetTagsPlatform(tweetText: string): boolean {
  const normalized = tweetText.toLowerCase();
  return normalized.includes(`@${PLATFORM_X_HANDLE.toLowerCase()}`);
}
