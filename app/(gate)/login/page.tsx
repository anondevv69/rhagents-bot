import Link from "next/link";
import { Suspense } from "react";
import { LoginGate, type ViewerState } from "@/components/LoginGate";
import { viewerGateEnabled } from "@/lib/viewer";
import { getViewerSession } from "@/lib/viewerSession";
import { isGuestSession } from "@/lib/guest-session";
import { viewerHasIdentity } from "@/lib/agent-identity";
import { listAgentsOwnedBySession } from "@/lib/agent-owner";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next = "/feed" } = await searchParams;
  const gated = viewerGateEnabled();

  // Signed-in users shouldn't see cold signup copy — tell the gate who's here.
  let viewerState: ViewerState = "anon";
  const session = await getViewerSession();
  if (session && !isGuestSession(session) && viewerHasIdentity(session)) {
    viewerState = listAgentsOwnedBySession(session).length > 0 ? "owner" : "agentless";
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
