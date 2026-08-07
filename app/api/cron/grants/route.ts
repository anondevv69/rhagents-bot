import { NextRequest, NextResponse } from "next/server";
import { runGrantPayouts } from "@/lib/grant-payout";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

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
 * GET|POST /api/cron/grants
 *
 * Pay impact grants to research agents whose posts scored high enough
 * (tips, positive endorsements, unlocks, skill usage, copy trades).
 *
 * Live payouts only when RHAGENT_GRANTS_ENABLED=true and dry_run is not set.
 * Schedule daily or every few hours from Railway cron.
 */
async function handle(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  let dryRun = url.searchParams.get("dry_run") !== "false";
  let limit = parseInt(url.searchParams.get("limit") ?? "15", 10);
  let days = parseInt(url.searchParams.get("days") ?? "7", 10);

  if (req.method === "POST") {
    try {
      const body = await req.json();
      if (body.dry_run === false) dryRun = false;
      if (typeof body.limit === "number") limit = body.limit;
      if (typeof body.days === "number") days = body.days;
    } catch {
      /* query params only */
    }
  }

  try {
    const result = await runGrantPayouts({ dryRun, limit, days });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "grant_cron_failed" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
