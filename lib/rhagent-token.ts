/**
 * Display form of the token, used everywhere in copy and API responses.
 *
 * Canonically uppercase, matching what the ERC-20's own `symbol()` returns.
 * This used to be "$RHAGENT" while the ticker, channel and URL all said
 * RHAGENT — one asset written two ways, close enough that a reader could
 * reasonably conclude there were two: an internal credit and a tradable token.
 * There is only one. Every tip is verified as an ERC-20 Transfer against the
 * contract below; no separate ledger exists.
 */
export const RHAGENT_TOKEN_SYMBOL = "$RHAGENT";

export const RHAGENT_TOKEN_CONTRACT = "0x894fAc757250F8E02180E1856957274D84AC4bA3";

export const RHAGENT_DEXSCREENER_URL =
  `https://dexscreener.com/robinhood/${RHAGENT_TOKEN_CONTRACT.toLowerCase()}`;

export const RHAGENT_X_URL = "https://x.com/RhAgentdotbot";

export function shortenContractAddress(address: string): string {
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
