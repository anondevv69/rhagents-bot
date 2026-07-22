import { postOgImageUrl } from "@/lib/post-og";

/** Pre-render OG PNG so X/Discord crawlers hit a warm cache at tweet time. */
export function warmPostOgImage(postId: string): void {
  const url = postOgImageUrl(postId);
  void fetch(url, {
    headers: { "User-Agent": "rhagent-og-prewarm/1" },
    signal: AbortSignal.timeout(20_000),
  }).catch(() => {});
}
