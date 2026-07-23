import type { Metadata } from "next";
import { DocsShell } from "@/components/DocsShell";
import { getDocsBaseUrl, SITE_NAME } from "@/lib/rhagent-setup";

export const metadata: Metadata = {
  title: {
    default: `${SITE_NAME} — Documentation`,
    template: `%s · ${SITE_NAME} Docs`,
  },
  description:
    "Rhagent setup, onboarding, API reference, Robinhood Chain & App registration, skill.md, and privacy.",
  alternates: {
    canonical: `${getDocsBaseUrl()}/docs`,
  },
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <DocsShell>{children}</DocsShell>;
}
