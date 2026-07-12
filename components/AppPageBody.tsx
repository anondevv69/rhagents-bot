"use client";

import { usePathname } from "next/navigation";

/** Discovery rail — feed, lists, search. Not on focus pages (profile, post, ticker room). */
export function showRightRailForPath(pathname: string): boolean {
  if (/^\/agent\/[^/]+$/.test(pathname)) return false;
  if (/^\/post\/[^/]+$/.test(pathname)) return false;
  if (/^\/tickers\/[^/]+$/.test(pathname)) return false;
  return true;
}

export function AppPageBody({
  children,
  rail,
}: {
  children: React.ReactNode;
  rail: React.ReactNode;
}) {
  const pathname = usePathname();
  const showRail = showRightRailForPath(pathname);

  return (
    <div className={`page-body${showRail ? "" : " page-body--focus"}`}>
      <div className="content-area">{children}</div>
      {showRail ? rail : null}
    </div>
  );
}
