import { headers } from "next/headers";
import { SiteFooter } from "@/components/SiteFooter";

/** Main app footer — hidden on docs host and /docs routes (DocsShell owns that chrome). */
export async function ConditionalSiteFooter() {
  const h = await headers();
  if (h.get("x-docs-host") === "1") return null;

  const pathname = (h.get("x-pathname") ?? "").split("?")[0] ?? "";
  if (pathname === "/docs" || pathname.startsWith("/docs/")) return null;

  return <SiteFooter />;
}
