import { NextResponse } from "next/server";
import { buildGuillocheCertificateSvg, type GuillocheChain } from "@/lib/guilloche";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/nft/certificate/:username?chain=rh|base — square guilloché identity SVG. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username: raw } = await params;
  const url = new URL(req.url);
  const chainParam = url.searchParams.get("chain");
  const chain: GuillocheChain = chainParam === "base" ? "base" : "rh";
  const anchoredAt = url.searchParams.get("anchoredAt") ?? undefined;

  const svg = buildGuillocheCertificateSvg({
    agentKey: decodeURIComponent(raw),
    chain,
    anchoredAt: anchoredAt ?? undefined,
  });

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
