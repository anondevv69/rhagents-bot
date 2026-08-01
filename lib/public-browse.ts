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
  // Wallet-only Apple Pay deposit page — first-time iMessage/Telegram/Discord
  // depositors open this with no rhagent.bot session at all.
  if (pathname === "/fund" || pathname.startsWith("/fund/")) return true;
  if (pathname === "/certificates" || pathname.startsWith("/certificates/")) return true;
  if (isPublicSharePath(pathname)) return true;
  return false;
}
