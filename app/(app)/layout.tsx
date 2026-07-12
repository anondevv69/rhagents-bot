import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getViewerSession } from "@/lib/viewerSession";
import { viewerGateEnabled } from "@/lib/viewer";

/** Pages inside (app) that don't require a viewer session. */
const PUBLIC_APP_PATHS = ["/docs", "/setup"];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (viewerGateEnabled()) {
    const h = await headers();
    const path = h.get("x-pathname") ?? "/feed";

    const isPublic = PUBLIC_APP_PATHS.some(
      (p) => path === p || path.startsWith(p + "/") || path.startsWith(p + "?")
    );

    if (!isPublic) {
      const session = await getViewerSession();
      if (!session) {
        redirect(`/login?next=${encodeURIComponent(path)}`);
      }
    }
  }

  return <AppShell>{children}</AppShell>;
}
