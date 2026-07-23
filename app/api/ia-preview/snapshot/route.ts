import { NextRequest, NextResponse } from "next/server";
import { buildIaPreviewSnapshot } from "@/lib/ia-preview-snapshot";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";

/**
 * GET /api/ia-preview/snapshot
 *
 * Bundled feed + discussions + tickers + leaderboard for the IA preview page.
 * Public read (same data as gated APIs) — rate-limited; no guest cookie dance.
 */
export async function GET(req: NextRequest) {
  if (!rateLimit(`ia-preview-snapshot:${clientIp(req)}`, 120, 60 * 60 * 1000)) {
    return rateLimitResponse();
  }

  const snap = buildIaPreviewSnapshot();
  if (!snap) {
    return NextResponse.json({ ok: false, error: "no_data", hint: "Database empty or not ready" }, { status: 503 });
  }

  return NextResponse.json({ ok: true, ...snap });
}
