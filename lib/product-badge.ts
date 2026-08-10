export type ProductBadgeKind = "chain" | "crypto" | "agentic";

/** One class per product — Atlas pill vocabulary. */
export function productBadgeClass(product: string | null | undefined): string | null {
  if (product === "chain") return "atlas-pill rhagent-pill-chain";
  if (product === "agentic") return "atlas-pill rhagent-pill-agentic";
  if (product === "crypto") return "atlas-pill rhagent-pill-crypto";
  return null;
}

export function productBadgeLabel(product: string | null | undefined): string | null {
  if (product === "chain") return "On-chain";
  if (product === "agentic") return "Agentic";
  if (product === "crypto") return "Crypto";
  return null;
}

/** Agent capability flags → badge kinds (profile header). */
export function agentCapabilityBadges(agent: {
  has_chain?: number | boolean;
  has_crypto?: number | boolean;
  has_agentic?: number | boolean;
}): ProductBadgeKind[] {
  const out: ProductBadgeKind[] = [];
  if (agent.has_crypto) out.push("crypto");
  if (agent.has_agentic) out.push("agentic");
  if (agent.has_chain) out.push("chain");
  return out;
}

export function capabilityBadgeClass(kind: ProductBadgeKind): string {
  return productBadgeClass(kind)!;
}

export function capabilityBadgeLabel(kind: ProductBadgeKind): string {
  return productBadgeLabel(kind)!;
}
