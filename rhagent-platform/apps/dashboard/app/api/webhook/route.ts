/**
 * POST /api/webhook — general webhook endpoint for bot ↔ dashboard communication.
 * Handles: wallet provision requests, env sync, status queries.
 */
import { NextRequest, NextResponse } from "next/server";
import { getBankrClient } from "@/lib/bankr";

export async function POST(request: NextRequest) {
  const bridgeSecret = request.headers.get("x-bridge-secret");
  if (!bridgeSecret || bridgeSecret !== process.env.BRIDGE_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { action, ...params } = body;

  switch (action) {
    case "provision":
      return handleProvision(params);
    case "set_env":
      return handleSetEnv(params);
    case "get_credits":
      return handleGetCredits(params);
    default:
      return NextResponse.json({ error: `unknown action: ${action}` }, { status: 400 });
  }
}

async function handleProvision(params: Record<string, unknown>) {
  const bankr = getBankrClient();
  const result = await bankr.provisionWallet(
    params.platform as string,
    params.externalId as string,
    params.platformUserId as string | undefined,
  );

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    evm_address: result.evmAddress,
    wallet_id: result.walletId,
    api_key: result.apiKey,
    is_new: result.isNew,
  });
}

async function handleSetEnv(params: Record<string, unknown>) {
  const apiKey = params.apiKey as string;
  const vars = params.vars as Record<string, string>;
  if (!apiKey || !vars) {
    return NextResponse.json({ error: "apiKey and vars required" }, { status: 400 });
  }

  try {
    const bankr = getBankrClient();
    await bankr.setEnvVars(apiKey, vars);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "failed" },
      { status: 500 },
    );
  }
}

async function handleGetCredits(params: Record<string, unknown>) {
  const apiKey = params.apiKey as string;
  if (!apiKey) {
    return NextResponse.json({ error: "apiKey required" }, { status: 400 });
  }

  try {
    const bankr = getBankrClient();
    const credits = await bankr.getLlmCredits(apiKey);
    return NextResponse.json({ ok: true, credits });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "failed" },
      { status: 500 },
    );
  }
}
