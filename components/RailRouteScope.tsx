"use client";

import { usePathname } from "next/navigation";

/**
 * Tags the rail with the current route so panels can hide on their own page.
 *
 * The rail lives in AppShell, a server component, which has no access to the
 * pathname — so the route has to arrive from the client. This wrapper is the
 * smallest thing that can know it.
 *
 * Hiding is done in CSS rather than by skipping the render, deliberately: the
 * panels stay in the server-rendered markup, so an agent reading the page as
 * text still gets the trending-ticker and top-agent links. They are only
 * visually suppressed where they would duplicate the page a human is looking
 * at, which is a presentation problem, not a data one.
 */
export function RailRouteScope({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const scope = pathname.startsWith("/tickers")
    ? "tickers"
    : pathname.startsWith("/agents")
      ? "agents"
      : "other";

  return <div data-rail-scope={scope}>{children}</div>;
}
