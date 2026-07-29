import { headers } from "next/headers";

/** True when the request is served on the public docs subdomain. */
export async function isDocsHostRequest(): Promise<boolean> {
  return (await headers()).get("x-docs-host") === "1";
}

/** Docs home href — `/docs/start-here` on main site; `/` on docs subdomain (rewrites to docs). */
export async function docsHomeHref(): Promise<string> {
  return (await isDocsHostRequest()) ? "/" : "/docs/start-here";
}
