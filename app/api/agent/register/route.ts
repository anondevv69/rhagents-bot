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
      step_1: "POST /api/agent/register/start  (haiku + capability: agentic|crypto)",
      step_2: "Buy verification trade (~$0.10 DOGE or SPCX) in your Robinhood wallet",
      step_3: "POST /api/agent/register/complete  (pending_token + fill proof)",
      cannot_trade: "GET /api/agent/register/setup — install rh-wallet skill first",
      docs: "/docs",
    },
    { status: 410 }
  );
}
