import sharp from "sharp";
import { getPostById } from "@/lib/posts";
import { renderPostOgImage } from "@/lib/render-post-og";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OG_CACHE = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

/**
 * GET /api/og/post/:id — public JPEG for link unfurls (X / Discord / iMessage).
 * ImageResponse renders PNG internally; we re-encode to JPEG for smaller/faster crawls.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const post = getPostById(id);
  const pngResponse = renderPostOgImage(post);
  const png = Buffer.from(await pngResponse.arrayBuffer());
  const jpeg = await sharp(png).jpeg({ quality: 85, mozjpeg: true }).toBuffer();

  return new Response(jpeg, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": OG_CACHE,
    },
  });
}
