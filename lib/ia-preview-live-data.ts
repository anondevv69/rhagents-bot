import { cookies } from "next/headers";
import { getAgentLeaderboard, type LeaderboardAgent } from "./agents-leaderboard";
import type { FeedPost } from "./posts";
import { CANONICAL_SITE_URL, getSiteBaseUrl } from "./rhagent-setup";
import { buildIaPreviewSnapshot } from "./ia-preview-snapshot";
import { VIEWER_COOKIE } from "./viewer";
import type { IaPreviewLiveData, IaPreviewProfile, IaPreviewThread } from "./ia-preview-types";
import type { SymbolStats } from "./symbols";
import { agentBadges } from "./ia-preview-types";

export type { IaPreviewLiveData, IaPreviewProfile, IaPreviewThread } from "./ia-preview-types";

const EMPTY: IaPreviewLiveData = {
  source: "remote",
  fetchedAt: new Date().toISOString(),
  feed: [],
  discussions: [],
  tickers: [],
  leaderboard: [],
  profile: null,
  error: null,
};

async function fetchSnapshotJson(
  baseUrl: string,
  headers: Record<string, string> = {},
): Promise<IaPreviewLiveData | null> {
  const res = await fetch(`${baseUrl}/api/ia-preview/snapshot`, {
    headers,
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as IaPreviewLiveData & { ok?: boolean };
  if (json.ok === false || !json.feed?.length) return null;
  return {
    source: baseUrl === getSiteBaseUrl() ? "local" : "remote",
    fetchedAt: json.fetchedAt ?? new Date().toISOString(),
    feed: json.feed ?? [],
    discussions: json.discussions ?? [],
    tickers: json.tickers ?? [],
    leaderboard: json.leaderboard ?? [],
    profile: json.profile ?? null,
    error: null,
  };
}

async function fetchRemoteJson<T>(url: string, cookie: string): Promise<T> {
  const res = await fetch(url, { headers: { Cookie: cookie }, cache: "no-store" });
  if (!res.ok) throw new Error(`Remote ${url} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

async function remoteGuestCookie(baseUrl: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/viewer/guest?next=/ia-preview-live`, { redirect: "manual", cache: "no-store" });
  if (res.status === 429) throw new Error("rate_limited");
  const cookies = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  const viewer = cookies.find((c) => c.startsWith("rhagents_viewer="));
  if (!viewer) throw new Error("no_guest_cookie");
  return viewer.split(";")[0] ?? "";
}

async function loadRemoteLegacy(baseUrl: string): Promise<IaPreviewLiveData | null> {
  const cookie = await remoteGuestCookie(baseUrl);
  const [feedRes, discRes, tickersRes, lbRes] = await Promise.all([
    fetchRemoteJson<{ posts: FeedPost[] }>(`${baseUrl}/api/feed?limit=12&sort=trending`, cookie),
    fetchRemoteJson<{ posts: FeedPost[] }>(`${baseUrl}/api/discussions?limit=8&sort=trending`, cookie),
    fetchRemoteJson<{ tickers: SymbolStats[] }>(`${baseUrl}/api/tickers?limit=12&sort=trending`, cookie),
    fetchRemoteJson<{ agents: LeaderboardAgent[] }>(
      `${baseUrl}/api/agents/leaderboard?limit=12&sort=pnl&tab=agents`,
      cookie,
    ),
  ]);

  const discussions: IaPreviewThread[] = [];
  for (const post of discRes.posts) {
    let comments: FeedPost[] = [];
    if ((post.reply_count ?? 0) > 0) {
      try {
        const detail = await fetchRemoteJson<{ comments: FeedPost[] }>(
          `${baseUrl}/api/post/${post.id}`,
          cookie,
        );
        comments = detail.comments ?? [];
      } catch {
        comments = [];
      }
    }
    discussions.push({ post, comments });
  }

  const leaderboard = lbRes.agents ?? [];
  const featured =
    leaderboard.find((a) => a.trade_count > 5)?.username ??
    leaderboard.find((a) => a.username === "rayblancoeth")?.username ??
    leaderboard[0]?.username;

  let profile: IaPreviewProfile | null = null;
  const lb = featured ? leaderboard.find((r) => r.username === featured) ?? null : null;
  if (featured && lb) {
    const agentPosts = feedRes.posts.filter((p) => p.agent_username === featured);
    const agentDiscussions = discRes.posts.filter((p) => p.agent_username === featured);
    const allPosts = [...agentDiscussions, ...agentPosts];
    profile = {
      username: lb.username ?? featured,
      displayName: lb.display_name ?? featured,
      badges: agentBadges(lb),
      ownerHandle: lb.owner_x_handle,
      xVerified: !!lb.x_verified,
      activeSkill: allPosts.find((p) => p.agent_active_skill_name)?.agent_active_skill_name?.trim() || null,
      leaderboard: lb,
      counts: { posts: lb.post_count, trades: lb.trade_count, comments: 0 },
      posts: allPosts.filter((p) => p.type === "general" || p.type === "research"),
      trades: allPosts.filter((p) => p.type === "trade_fill" || p.type === "trade_intent"),
      replies: [],
    };
  }

  return {
    source: "remote",
    fetchedAt: new Date().toISOString(),
    feed: feedRes.posts,
    discussions,
    tickers: tickersRes.tickers,
    leaderboard,
    profile,
    error: null,
  };
}

/** Live rhagent.bot data for IA preview — local DB, snapshot API, then legacy guest fetch. */
export async function loadIaPreviewLiveData(): Promise<IaPreviewLiveData> {
  const local = buildIaPreviewSnapshot();
  if (local) return { ...local, error: null };

  const siteBase = getSiteBaseUrl();

  // Same-host snapshot (prod DB via API).
  try {
    const sameHost = await fetchSnapshotJson(siteBase);
    if (sameHost) return sameHost;
  } catch {
    /* continue */
  }

  // Local dev → production snapshot (no guest cookie; avoids /api/viewer/guest rate limits).
  if (siteBase !== CANONICAL_SITE_URL) {
    try {
      const prod = await fetchSnapshotJson(CANONICAL_SITE_URL);
      if (prod) return prod;
    } catch {
      /* continue */
    }
  }

  const previewKey = process.env.RHAGENTS_PREVIEW_AGENT_KEY?.trim();
  if (previewKey) {
    try {
      const authed = await fetchSnapshotJson(siteBase, { Authorization: `Bearer ${previewKey}` });
      if (authed) return authed;
    } catch {
      /* continue */
    }
  }

  // Legacy: guest cookie + individual APIs (may 429 if probed too often).
  try {
    const legacy = await loadRemoteLegacy(CANONICAL_SITE_URL);
    if (legacy) return legacy;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "rate_limited") {
      return {
        ...EMPTY,
        error:
          "Production API rate-limited guest access (429). Deploy latest code for /api/ia-preview/snapshot, or open https://rhagent.bot/ia-preview-live after deploy.",
      };
    }
  }

  const cookieStore = await cookies();
  if (cookieStore.get(VIEWER_COOKIE)?.value) {
    return {
      ...EMPTY,
      error:
        "Your browser has a viewer cookie but this dev server has an empty database. Deploy to production or wait for /api/ia-preview/snapshot on rhagent.bot.",
    };
  }

  return {
    ...EMPTY,
    error:
      siteBase === CANONICAL_SITE_URL
        ? "No posts in the database yet."
        : "Could not load preview data. After deploy, this page pulls from https://rhagent.bot/api/ia-preview/snapshot automatically.",
  };
}
