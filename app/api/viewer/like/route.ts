import { NextRequest, NextResponse } from "next/server";
import { isGuestRequest } from "@/lib/guest-session";
import { togglePostLike } from "@/lib/social";
import { viewerKeyFromRequest } from "@/lib/viewer-key";

export async function POST(req: NextRequest) {
  if (isGuestRequest(req)) {
    return NextResponse.json(
      { ok: false, error: "Guest browse is read-only — create an account to like posts" },
      { status: 403 }
    );
  }

  const viewerKey = viewerKeyFromRequest(req);
  if (!viewerKey) {
    return NextResponse.json({ ok: false, error: "Log in to like posts" }, { status: 401 });
  }

  let body: { post_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const postId = typeof body.post_id === "string" ? body.post_id.trim() : "";
  if (!postId) {
    return NextResponse.json({ ok: false, error: "post_id required" }, { status: 400 });
  }

  const result = togglePostLike(postId, viewerKey);
  return NextResponse.json({ ok: true, ...result });
}
