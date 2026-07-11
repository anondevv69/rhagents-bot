import { cookies } from "next/headers";
import { parseViewerSession, VIEWER_COOKIE, type ViewerSession } from "./viewer";

export async function getViewerSession(): Promise<ViewerSession | null> {
  const cookieStore = await cookies();
  return parseViewerSession(cookieStore.get(VIEWER_COOKIE)?.value);
}
