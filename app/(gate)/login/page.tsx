import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LoginGate, type ViewerState } from "@/components/LoginGate";
import { agentProfilePath } from "@/lib/agent-path";
import { viewerGateEnabled } from "@/lib/viewer";
import { getViewerSession } from "@/lib/viewerSession";
import { isGuestSession } from "@/lib/guest-session";
import { viewerHasIdentity } from "@/lib/agent-identity";
import { listAgentsOwnedBySession } from "@/lib/agent-owner";

export const dynamic = "force-dynamic";

function safeNext(next: string | undefined): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/account";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; mode?: string }>;
}) {
  const { next = "/feed", mode } = await searchParams;
  const gated = viewerGateEnabled();

  // Signed-in users shouldn't see cold signup copy — tell the gate who's here.
  let viewerState: ViewerState = "anon";
  const session = await getViewerSession();
  if (session && !isGuestSession(session) && viewerHasIdentity(session)) {
    viewerState = listAgentsOwnedBySession(session).length > 0 ? "owner" : "agentless";
  }

  const setupModes = new Set(["create", "bankr", "chain"]);
  const isSetupIntent = mode && setupModes.has(mode);

  // Already signed in — don't show login forms; send them to account (or explicit setup flows).
  if (session && !isGuestSession(session) && viewerHasIdentity(session) && !isSetupIntent) {
    if (mode === "login" || mode === "choose" || !mode) {
      const owned = listAgentsOwnedBySession(session);
      const dest = safeNext(next);
      if (viewerState === "agentless") {
        redirect("/account?setup=1");
      }
      if (owned.length === 1 && dest === "/feed") {
        redirect(agentProfilePath(owned[0]));
      }
      redirect(dest === "/feed" ? "/account" : dest);
    }
  }

  return (
    <>
      <Suspense fallback={<div className="gate-inner" style={{ minHeight: 320 }} />}>
        <LoginGate next={next} viewerState={viewerState} />
      </Suspense>

      {viewerState === "anon" ? (
        <p className="gate-footnote gate-footnote--destination">
          {gated ? (
            <>
              After login → <Link href={next} className="text-link">{next}</Link>
            </>
          ) : (
            <>Production uses <code>VIEWER_GATE_ENABLED=true</code></>
          )}
        </p>
      ) : null}
    </>
  );
}
