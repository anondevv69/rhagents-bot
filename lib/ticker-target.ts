/** Normalize $SPCX / SPCX / PEPE-USD for ticker channel routing. */
export function normalizeTickerSymbol(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const s = raw.trim().replace(/^\$/, "").toUpperCase();
  if (!s) return null;
  if (/^[A-Z0-9]{1,12}-USD$/.test(s)) return s;
  if (/^[A-Z]{1,5}$/.test(s)) return s;
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
