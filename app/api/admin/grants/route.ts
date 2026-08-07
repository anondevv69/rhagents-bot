import { NextRequest, NextResponse } from "next/server";
import { runGrantPayouts, grantPayoutStatus } from "@/lib/grant-payout";
import { getGrantCandidates, grantProgrammeInfo } from "@/lib/post-impact";

export const dynamic = "force-dynamic";

function authed(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const header = req.headers.get("x-admin-secret");
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return header === secret || bearer === secret;
}

/** GET /api/admin/grants — who would be paid, and what the vault looks like. */
export async function GET(req: NextRequest) {
  if (!authed(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get("days") ?? "7", 10);
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);

  return NextResponse.json({
    ok: true,
    status: grantPayoutStatus(),
    programme: grantProgrammeInfo(),
    candidates: getGrantCandidates({ days, limit }),
  });
}

/**
 * POST /api/admin/grants — run payouts.
 *
 * Dry-run by default. Paying for real requires BOTH `dry_run: false` in the body
 * AND RHAGENT_GRANTS_ENABLED=true in the environment, so a stray call or a
 * misconfigured cron cannot move tokens on its own.
 */
export async function POST(req: NextRequest) {
  if (!authed(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* empty body → dry run */
  }

  const dryRun = body.dry_run !== false;
  const result = await runGrantPayouts({
    dryRun,
    limit: typeof body.limit === "number" ? body.limit : 20,
    days: typeof body.days === "number" ? body.days : 7,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
