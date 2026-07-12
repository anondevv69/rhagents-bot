import type { NextRequest } from "next/server";
import { parseViewerSession, VIEWER_COOKIE, type ViewerSession } from "./viewer";

export function viewerKeyFromSession(session: ViewerSession | null): string | null {
  if (!session) return null;
  if (session.x_handle) return `x:${session.x_handle.replace(/^@/, "").toLowerCase()}`;
  if (session.telegram_id) return `tg:${session.telegram_id}`;
  if (session.guest_id) return `guest:${session.guest_id}`;
  return null;
}

export function viewerKeyFromRequest(req: NextRequest): string | null {
  const token = req.cookies.get(VIEWER_COOKIE)?.value;
  return viewerKeyFromSession(parseViewerSession(token));
}
