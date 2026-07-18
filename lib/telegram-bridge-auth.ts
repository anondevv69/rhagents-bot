/** Shared-secret auth for the trading bot → rhagentsite Telegram bridge. */
export function telegramBridgeSecret(): string | null {
  const s = process.env.TELEGRAM_BRIDGE_SECRET?.trim();
  return s && s.length >= 16 ? s : null;
}

export function bridgeSecretOk(header: string | null): boolean {
  const expected = telegramBridgeSecret();
  if (!expected || !header) return false;
  return header.trim() === expected;
}
