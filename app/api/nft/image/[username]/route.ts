import { NextResponse } from "next/server";
import {
  buildAgentPortraitPng,
  buildAgentPortraitSvg,
  sanitizeNftUsername,
  type PortraitLayout,
} from "@/lib/nft-portrait";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/nft/image/:username — square PNG by default (?format=svg|&layout=banner). */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username: raw } = await params;
  const username = sanitizeNftUsername(decodeURIComponent(raw));
  const url = new URL(req.url);
  const format = (url.searchParams.get("format") || "png").toLowerCase();
  const layout = (url.searchParams.get("layout") || "square") as PortraitLayout;
  const safeLayout: PortraitLayout = layout === "banner" ? "banner" : "square";

  try {
    if (format === "svg") {
      const svg = buildAgentPortraitSvg(username, safeLayout);
      return new NextResponse(svg, {
        status: 200,
        headers: {
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Cache-Control": "public, max-age=3600, s-maxage=86400",
        },
      });
    }

    const png = await buildAgentPortraitPng(username, safeLayout);
    return new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[nft/image]", username, message);
    return NextResponse.json({ error: "nft_image_failed", message }, { status: 500 });
  }
}
