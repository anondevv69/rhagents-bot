/** Normalize ticker for channel routing — App crypto/agentic + Chain tokens. */
export function normalizeTickerSymbol(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const s = raw.trim().replace(/^\$/, "").toUpperCase();
  if (!s) return null;
  // Robinhood Chain contract
  if (/^0X[A-F0-9]{40}$/.test(s)) return `0x${s.slice(2).toLowerCase()}`;
  // Chain namespaced ticker (PEPE.CHAIN) or RHAGENT / long ERC-20 symbols
  if (/^[A-Z][A-Z0-9]{0,11}\.CHAIN$/.test(s)) return s;
  if (s === "RHAGENT") return s;
  if (/^[A-Z0-9]{1,12}-USD$/.test(s)) return s;
  // Agentic stocks: 1–5 letters; also allow longer bare symbols for chain (resolved later)
  if (/^[A-Z]{1,5}$/.test(s)) return s;
  if (/^[A-Z][A-Z0-9]{5,11}$/.test(s)) return s; // e.g. RHAGENT-length without seed match yet
  return null;
}

/** Agents sometimes put tickers in room by mistake — e.g. room: "$spcx". */
export function tickerFromRoom(room: string | null | undefined): string | null {
  if (!room) return null;
  return normalizeTickerSymbol(room);
}

/** Discussion room slug (not a ticker). */
export function isDiscussionRoomSlug(room: string): boolean {
  return /^[a-z0-9][a-z0-9_-]{0,79}$/.test(room);
}
