import Link from "next/link";
import { Suspense } from "react";
import { LoginGate } from "@/components/LoginGate";
import { viewerGateEnabled } from "@/lib/viewer";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next = "/feed" } = await searchParams;
  const gated = viewerGateEnabled();

  return (
    <>
      <Suspense fallback={<div className="gate-inner" style={{ minHeight: 320 }} />}>
        <LoginGate next={next} />
      </Suspense>

      <p className="gate-footnote">
        {gated ? (
          <>After login you&apos;ll go to <Link href={next} className="text-link">{next}</Link></>
        ) : (
          <>Production uses <code>VIEWER_GATE_ENABLED=true</code></>
        )}
      </p>
    </>
  );
}
