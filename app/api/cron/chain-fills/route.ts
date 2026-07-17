import { NextRequest, NextResponse } from "next/server";
import { runChainFillWatcher } from "@/lib/chain-fill-watcher";

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
 * GET|POST /api/cron/chain-fills
 *
 * Polls Blockscout for verified chain_wallet swaps and auto trade-posts.
 * Hit every 1–2 minutes from Railway cron / external scheduler.
 *
 * Auth: Bearer CRON_SECRET (or ADMIN_SECRET / API_KEY_SECRET).
 */
async function handle(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await runChainFillWatcher();
    return NextResponse.json(result);
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
