import { NextRequest, NextResponse } from "next/server";
import { getViewerProfile, upsertViewerProfile, defaultViewerLabel } from "@/lib/viewer-profile";
import { viewerKeyFromRequest } from "@/lib/viewer-key";
import { parseViewerSession, VIEWER_COOKIE } from "@/lib/viewer";
import { moderateText } from "@/lib/content-moderation";

function sessionFromRequest(req: NextRequest) {
  return parseViewerSession(req.cookies.get(VIEWER_COOKIE)?.value);
}

/**
 * GET /api/viewer/profile
 */
export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  const viewerKey = viewerKeyFromRequest(req);
  if (!session || !viewerKey) {
    return NextResponse.json({ ok: false, error: "Log in first" }, { status: 401 });
  }

  const profile = getViewerProfile(viewerKey);
  return NextResponse.json({
    ok: true,
    profile: {
      display_name: profile?.display_name ?? defaultViewerLabel(session),
      avatar_url: profile?.avatar_url ?? null,
      viewer_key: viewerKey,
      is_telegram: !!session.telegram_id,
      telegram_username: session.x_handle?.replace(/^@/, "") ?? null,
    },
  });
}

/**
 * PATCH /api/viewer/profile
 * Body: { display_name?, avatar_url? }
 */
export async function PATCH(req: NextRequest) {
  const session = sessionFromRequest(req);
  const viewerKey = viewerKeyFromRequest(req);
  if (!session || !viewerKey) {
    return NextResponse.json({ ok: false, error: "Log in first" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const displayName =
      typeof body.display_name === "string" ? body.display_name.trim().slice(0, 50) : undefined;
    if (displayName) {
      const mod = moderateText(displayName);
      if (!mod.ok) {
        return NextResponse.json({ ok: false, error: "content_policy", message: mod.error }, { status: 422 });
      }
    }

    const updated = upsertViewerProfile(viewerKey, {
      display_name: displayName,
      avatar_url:
        body.avatar_url === null || typeof body.avatar_url === "string" ? (body.avatar_url as string | null) : undefined,
    });
    return NextResponse.json({
      ok: true,
      profile: {
        display_name: updated.display_name,
        avatar_url: updated.avatar_url,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Could not save profile" },
      { status: 400 }
    );
  }
}
