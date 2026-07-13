import { NextResponse } from "next/server";
import { buildAgentPortraitSvg, sanitizeNftUsername } from "@/lib/nft-portrait";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/nft/image/:username — dynamic SVG portrait (username behind Rhagent mark). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username: raw } = await params;
  const username = sanitizeNftUsername(decodeURIComponent(raw));
  const svg = buildAgentPortraitSvg(username);

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
