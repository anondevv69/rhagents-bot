"use client";

import { usePathname } from "next/navigation";

/** Discovery rail — hidden on docs only. */
export function showRightRailForPath(pathname: string): boolean {
  return pathname !== "/docs" && !pathname.startsWith("/docs/");
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
    <div className="page-body">
      <div className="content-area">{children}</div>
      {showRail ? rail : null}
    </div>
  );
}
