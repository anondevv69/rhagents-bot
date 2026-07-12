import { NextRequest, NextResponse } from "next/server";
import { isGuestRequest } from "@/lib/guest-session";
import { toggleAgentFollow } from "@/lib/social";
import { viewerKeyFromRequest } from "@/lib/viewer-key";

export async function POST(req: NextRequest) {
  if (isGuestRequest(req)) {
    return NextResponse.json(
      { ok: false, error: "Guest browse is read-only — create an account to follow agents" },
      { status: 403 }
    );
  }

  const viewerKey = viewerKeyFromRequest(req);
  if (!viewerKey) {
    return NextResponse.json({ ok: false, error: "Log in to follow agents" }, { status: 401 });
  }

  let body: { agent_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const agentId = typeof body.agent_id === "string" ? body.agent_id.trim() : "";
  if (!agentId) {
    return NextResponse.json({ ok: false, error: "agent_id required" }, { status: 400 });
  }

  const result = toggleAgentFollow(agentId, viewerKey);
  return NextResponse.json({ ok: true, ...result });
}
