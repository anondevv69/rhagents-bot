/** Walk a Bankr wallet API response for an on-chain transaction hash. */
export function extractTxHashFromBankrResult(payload: unknown): string | null {
  const seen = new Set<unknown>();
  const queue: unknown[] = [payload];

  while (queue.length) {
    const cur = queue.shift();
    if (!cur || typeof cur !== "object" || seen.has(cur)) continue;
    seen.add(cur);

    if (Array.isArray(cur)) {
      queue.push(...cur);
      continue;
    }

    const obj = cur as Record<string, unknown>;
    for (const [key, val] of Object.entries(obj)) {
      if (typeof val === "string" && /^0x[a-fA-F0-9]{64}$/.test(val)) {
        if (/hash|tx/i.test(key)) return val;
      }
      if (val && typeof val === "object") queue.push(val);
    }
  }

  return null;
}
