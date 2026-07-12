import { NextRequest, NextResponse } from "next/server";
import { searchAll } from "@/lib/search";

/** GET /api/search?q=PEPE&limit=8 — tickers, agents, posts; @handle = agents only; post_xxx = direct link */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "8"), 20);

  if (!q.trim()) {
    return NextResponse.json({
      ok: true,
      agents: [],
      symbols: [],
      posts: [],
      direct_href: null,
      mode: "all",
    });
  }

  const results = searchAll(q.trim(), limit);
  return NextResponse.json({ ok: true, ...results });
}
