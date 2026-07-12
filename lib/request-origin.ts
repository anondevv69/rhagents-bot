import type { NextRequest } from "next/server";
import { getSiteBaseUrl } from "@/lib/rhagent-setup";

/** Public origin for redirects — prefers proxy headers over internal req.url host. */
export function requestOrigin(req: NextRequest): string {
  const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || req.headers.get("host")?.split(",")[0]?.trim();
  if (!host) return getSiteBaseUrl();

  const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const proto = forwardedProto || (isLocal ? "http" : "https");
  return `${proto}://${host}`;
}

export function redirectPath(req: NextRequest, pathname: string): URL {
  return new URL(pathname, requestOrigin(req));
}
