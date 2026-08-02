"use client";

import { PrivyProvider } from "@privy-io/react-auth";

export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

/**
 * Wraps children in Privy only when NEXT_PUBLIC_PRIVY_APP_ID is set — the whole
 * Privy path is dark until the app ID lands in the environment.
 */
export function PrivyAuthProvider({ children }: { children: React.ReactNode }) {
  if (!PRIVY_APP_ID) return <>{children}</>;
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        // Email/social users get an invisible embedded wallet — that wallet then
        // signs the same ownership challenge MetaMask users sign.
        embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" } },
        appearance: {
          theme: "dark",
          accentColor: "#00c805",
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
