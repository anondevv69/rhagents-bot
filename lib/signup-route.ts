import type { InteractMethod, VerifyMethod } from "@/components/SignupPathPicker";

/** Where Step 1 + Step 2 send the user. */
export function signupDestination(
  verify: VerifyMethod,
  interact: InteractMethod,
): { href: string; mode?: "chain" | "create" } {
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
