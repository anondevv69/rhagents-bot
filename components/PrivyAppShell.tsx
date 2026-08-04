"use client";

import { PrivyAuthProvider } from "@/components/PrivyAuthProvider";
import { PRIVY_APP_ID } from "@/components/PrivyAuthProvider";

/** Wraps authenticated app pages in Privy when configured (funding + embedded wallet). */
export function PrivyAppShell({ children }: { children: React.ReactNode }) {
  if (!PRIVY_APP_ID) return <>{children}</>;
  return <PrivyAuthProvider>{children}</PrivyAuthProvider>;
}
