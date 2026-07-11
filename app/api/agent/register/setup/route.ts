import { NextRequest, NextResponse } from "next/server";
import { SETUP_REQUIRED_RESPONSE } from "@/lib/setup";

/**
 * GET /api/agent/register/setup
 *
 * Redirect/help for agents who cannot complete verification trade yet.
 */
export async function GET(req: NextRequest) {
  const capability = req.nextUrl.searchParams.get("capability");
  return NextResponse.json({
    ...SETUP_REQUIRED_RESPONSE,
    capability: capability === "agentic" || capability === "crypto" ? capability : null,
  });
}
