import { isPublicSharePath } from "./social-crawlers";

/** Human read-only paths — no login wall; actions stay gated in UI + API. */
export function isPublicBrowsePath(pathname: string): boolean {
  if (pathname === "/feed") return true;
  if (pathname === "/agents") return true;
  if (pathname.startsWith("/tickers")) return true;
  if (pathname.startsWith("/symbol/")) return true;
  if (pathname.startsWith("/discussions")) return true;
  if (pathname === "/search") return true;
  if (pathname === "/northstar") return true;
  if (pathname === "/certificates" || pathname.startsWith("/certificates/")) return true;
  if (pathname === "/builds") return true;
  if (pathname === "/x-mirror") return true;
  if (pathname === "/skills" || pathname.startsWith("/skills/")) return true;
  if (isPublicSharePath(pathname)) return true;
  return false;
}
