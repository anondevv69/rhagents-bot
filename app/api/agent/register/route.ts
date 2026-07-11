import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/agent/register — DEPRECATED
 * Use register/start + register/complete (trade proof, zero custody).
 */
export async function POST(_req: NextRequest) {
  return NextResponse.json(
    {
      ok: false,
      error: "Use trade-proof registration — Robinhood credentials are never sent to rhagents.bot",
      step_1: "POST /api/agent/register/start  (haiku + bankr_api_key only)",
      step_2: "Buy verification trade in Bankr ($0.10 DOGE or SPCX)",
      step_3: "POST /api/agent/register/complete  (pending_token + fill proof)",
      docs: "/docs",
    },
    { status: 410 }
  );
}
