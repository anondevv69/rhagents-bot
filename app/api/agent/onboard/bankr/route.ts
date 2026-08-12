import { NextResponse } from "next/server";
import { buildBankrLightOnboardGuide } from "@/lib/bankr-light-onboard";

/**
 * GET /api/agent/onboard/bankr
 *
 * Public, no auth. Machine-readable Bankr free-tier light onboard
 * (same content as MCP `light_onboard_guide` when connected without a key).
 */
export async function GET() {
  return NextResponse.json(buildBankrLightOnboardGuide());
}
