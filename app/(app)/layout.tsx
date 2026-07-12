import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getViewerSession } from "@/lib/viewerSession";
import { viewerGateEnabled } from "@/lib/viewer";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (viewerGateEnabled()) {
    const h = await headers();
    const path = h.get("x-pathname") ?? "/feed";

    const session = await getViewerSession();
    if (!session) {
      redirect(`/login?next=${encodeURIComponent(path)}`);
    }
  }

  return <AppShell>{children}</AppShell>;
}
