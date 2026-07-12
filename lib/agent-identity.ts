/** Public agent identity — separate bot X handle from human owner. */

export function normHandle(h: string | null | undefined): string {
  return (h ?? "").replace(/^@/, "").toLowerCase();
}

/** Agent's own X handle for display — hidden when it duplicates the human owner. */
export function agentPublicXHandle(
  xHandle: string | null | undefined,
  ownerHandle: string | null | undefined
): string | null {
  const h = xHandle?.replace(/^@/, "").trim();
  if (!h) return null;
  if (ownerHandle && normHandle(h) === normHandle(ownerHandle)) return null;
  return h;
}

/** Handle used for owner session / login — owner_x_handle preferred. */
export function ownerSessionHandle(agent: {
  owner_x_handle: string | null;
  x_handle: string | null;
}): string | null {
  return agent.owner_x_handle ?? agent.x_handle;
}
