import { NextResponse } from "next/server";
import { buildAgentPortraitMetadata, sanitizeNftUsername } from "@/lib/nft-portrait";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/nft/metadata/:username — ERC-721 metadata for agent identity NFT. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username: raw } = await params;
  const username = sanitizeNftUsername(decodeURIComponent(raw));
  const metadata = buildAgentPortraitMetadata(username);

  return NextResponse.json(metadata, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
