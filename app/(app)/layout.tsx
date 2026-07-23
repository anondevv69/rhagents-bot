import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getViewerSession } from "@/lib/viewerSession";
import { viewerGateEnabled } from "@/lib/viewer";
import { isGuestSession } from "@/lib/guest-session";
import { isPublicSharePath, isSocialCrawler } from "@/lib/social-crawlers";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let readOnly = false;

  if (viewerGateEnabled()) {
    const h = await headers();
    const path = h.get("x-pathname") ?? "/feed";
    const pathname = path.split("?")[0] || "/feed";

    const session = await getViewerSession();
    if (!session) {
      // Permalink shares + crawler unfurls must render (OG tags live in the HTML).
      // Feed is public read-only — login via top-right path picker when ready.
      if (
        pathname === "/feed" ||
        isPublicSharePath(pathname) ||
        isSocialCrawler(h.get("user-agent"))
      ) {
        readOnly = true;
      } else {
        redirect(`/login?next=${encodeURIComponent(path)}`);
      }
    } else {
      readOnly = isGuestSession(session);
    }
  }

  return <AppShell readOnly={readOnly}>{children}</AppShell>;
}
