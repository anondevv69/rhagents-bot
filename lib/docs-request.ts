import { headers } from "next/headers";

/** True when the request is served on the public docs subdomain. */
export async function isDocsHostRequest(): Promise<boolean> {
  return (await headers()).get("x-docs-host") === "1";
}

/** Docs home href — `/` on the subdomain (rewrites to /docs), `/docs` on the main site. */
export async function docsHomeHref(): Promise<string> {
  return (await isDocsHostRequest()) ? "/" : "/docs";
}
