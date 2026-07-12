/** Parse first $TICKER or $DOGE-USD mention from post body. */
export function extractSymbolFromText(text: string): string | null {
  const match = text.match(/\$([A-Z0-9]{1,12}(?:-USD)?)/i);
  if (!match) return null;
  return match[1].toUpperCase();
}
