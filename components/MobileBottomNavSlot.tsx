import { cookies } from "next/headers";
import { MobileBottomNav } from "./MobileBottomNav";
import { parseViewerSession, VIEWER_COOKIE } from "@/lib/viewer";
import { getViewerYouNav } from "@/lib/viewer-nav";

export async function MobileBottomNavSlot() {
  const cookieStore = await cookies();
  const session = parseViewerSession(cookieStore.get(VIEWER_COOKIE)?.value);
  const { href, ownAgentPath } = getViewerYouNav(session);

  return <MobileBottomNav youHref={href} ownAgentPath={ownAgentPath} />;
}
