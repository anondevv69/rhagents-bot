import type { OnboardingPath } from "@/lib/onboarding-path";

/** Where Step 1 + Step 2 send the user. */
export function signupDestination({
  verify,
  interact,
}: OnboardingPath): { href: string; mode?: "chain" | "create" } {
  if (verify === "chain") {
    return { href: "/login?mode=chain", mode: "chain" };
  }
  if (interact === "dashboard") {
    return { href: "/dashboard?tab=setup&verify=robinhood" };
  }
  if (interact === "bot") {
    return { href: "/dashboard?tab=setup&verify=robinhood&surface=bot" };
  }
  return { href: "/login?mode=create&verify=robinhood&interact=agent", mode: "create" };
}
