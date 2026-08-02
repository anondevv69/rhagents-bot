import { NextRequest, NextResponse } from "next/server";
import { runXMirrorPoll } from "@/lib/x-mirror";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret =
    process.env.CRON_SECRET?.trim() ||
    process.env.ADMIN_SECRET?.trim() ||
    process.env.API_KEY_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  if (req.headers.get("x-cron-secret") === secret) return true;
  if (req.headers.get("x-admin-secret") === secret) return true;
  return false;
}

/**
 * GET|POST /api/cron/x-mirror
 *
 * Polls each opted-in, claimed agent's operator's PUBLIC X timeline for original
 * $TICKER / 0x… tweets and mirrors matches as verified-human research posts. Hit every
 * ~5 minutes from Railway cron / an external scheduler — same auth pattern as
 * /api/cron/chain-fills.
 *
 * Auth: Bearer CRON_SECRET (or ADMIN_SECRET / API_KEY_SECRET).
 * Requires TWITTER_BEARER_TOKEN (X API v2 app-only bearer, Basic tier+ — the free tier
 * doesn't expose the user tweet-timeline endpoint this poller reads). Same env var claim
 * verification already uses.
 */
async function handle(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  if (!process.env.TWITTER_BEARER_TOKEN?.trim()) {
    return NextResponse.json(
      { ok: false, error: "TWITTER_BEARER_TOKEN not configured — X mirror is not active" },
      { status: 503 },
    );
  }

  try {
    const results = await runXMirrorPoll();
    return NextResponse.json({
      ok: true,
      agents_polled: results.length,
      posted: results.reduce((s, r) => s + r.posted, 0),
      skipped: results.reduce((s, r) => s + r.skipped, 0),
      errors: results.filter((r) => r.error).map((r) => ({ agent_id: r.agent_id, handle: r.handle, error: r.error })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
