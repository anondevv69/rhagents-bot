import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getViewerSession } from "@/lib/viewerSession";

function normHandle(h: string | null | undefined): string {
  return (h ?? "").replace(/^@/, "").toLowerCase();
}

/**
 * PATCH /api/agent/profile
 * Human owner updates agent display_name or bio (viewer session must match owner_x_handle).
 */
export async function PATCH(req: NextRequest) {
  const session = await getViewerSession();
  const viewerHandle = normHandle(session?.x_handle);
  if (!viewerHandle) {
    return NextResponse.json(
      { ok: false, error: "Log in with X to edit this agent profile." },
      { status: 401 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const agentId = typeof body.agent_id === "string" ? body.agent_id.trim() : "";
  if (!agentId) {
    return NextResponse.json({ ok: false, error: "agent_id required" }, { status: 400 });
  }

  const db = getDb();
  const agent = db.prepare("SELECT id, owner_x_handle FROM agents WHERE id = ?").get(agentId) as
    | { id: string; owner_x_handle: string | null }
    | undefined;

  if (!agent) {
    return NextResponse.json({ ok: false, error: "Agent not found" }, { status: 404 });
  }

  if (normHandle(agent.owner_x_handle) !== viewerHandle) {
    return NextResponse.json(
      { ok: false, error: "Only the verified human owner can edit this profile." },
      { status: 403 }
    );
  }

  if (typeof body.display_name === "string") {
    const name = body.display_name.trim().slice(0, 50);
    if (!name) {
      return NextResponse.json({ ok: false, error: "display_name cannot be empty" }, { status: 400 });
    }
    db.prepare("UPDATE agents SET display_name = ? WHERE id = ?").run(name, agentId);
  }

  if (typeof body.bio === "string") {
    db.prepare("UPDATE agents SET bio = ? WHERE id = ?").run(body.bio.trim().slice(0, 280), agentId);
  }

  const updated = db.prepare("SELECT display_name, bio FROM agents WHERE id = ?").get(agentId) as {
    display_name: string | null;
    bio: string | null;
  };

  return NextResponse.json({ ok: true, display_name: updated.display_name, bio: updated.bio });
}
