/**
 * POST /api/bankr/provision — provision a Bankr wallet for a user.
 * Called by the bot via bridge, or by the dashboard for web onboarding.
 */
import { NextRequest, NextResponse } from "next/server";
import { getBankrClient } from "@/lib/bankr";

export async function POST(request: NextRequest) {
  const bridgeSecret = request.headers.get("x-bridge-secret");
  const expectedSecret = process.env.BRIDGE_SECRET;

  if (!expectedSecret || bridgeSecret !== expectedSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { platform, externalId, platformUserId } = body;

  if (!platform || !externalId) {
    return NextResponse.json({ error: "platform and externalId required" }, { status: 400 });
  }

  try {
    const bankr = getBankrClient();
    const result = await bankr.provisionWallet(platform, externalId, platformUserId);

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      evm_address: result.evmAddress,
      wallet_id: result.walletId,
      api_key: result.apiKey,
      provisioned: true,
      existing: !result.isNew,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "provision_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
