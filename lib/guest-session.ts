import type { NextRequest } from "next/server";
import { parseViewerSession, VIEWER_COOKIE, type ViewerSession } from "./viewer";

/** Anonymous normie browse — read-only feed, no likes/follows/profile edits. */
export function isGuestSession(session: ViewerSession | null | undefined): boolean {
  return !!session?.guest_id && !session.x_handle && !session.telegram_id;
}

export function sessionFromRequest(req: NextRequest): ViewerSession | null {
  return parseViewerSession(req.cookies.get(VIEWER_COOKIE)?.value);
}

export function isGuestRequest(req: NextRequest): boolean {
  return isGuestSession(sessionFromRequest(req));
}
