import { getPostById } from "@/lib/posts";
import { renderPostOgImage } from "@/lib/render-post-og";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/og/post/:id — public PNG for link unfurls.
 * Kept outside the gated (app) tree so Discord/X/iMessage never hit /login.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const post = getPostById(id);
  const image = renderPostOgImage(post);
  // ImageResponse is a Response subclass — return as-is with short cache.
  image.headers.set("Cache-Control", "public, max-age=300, s-maxage=3600");
  return image;
}
