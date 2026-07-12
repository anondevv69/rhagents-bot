import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getViewerSession } from "@/lib/viewerSession";
import { viewerGateEnabled } from "@/lib/viewer";
import { isGuestSession } from "@/lib/guest-session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let readOnly = false;

  if (viewerGateEnabled()) {
    const h = await headers();
    const path = h.get("x-pathname") ?? "/feed";

    const session = await getViewerSession();
    if (!session) {
      redirect(`/login?next=${encodeURIComponent(path)}`);
    }
    readOnly = isGuestSession(session);
  }

  return <AppShell readOnly={readOnly}>{children}</AppShell>;
}
