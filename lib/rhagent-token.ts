export const RHAGENT_TOKEN_SYMBOL = "$rhagent";

export const RHAGENT_TOKEN_CONTRACT = "0x894fAc757250F8E02180E1856957274D84AC4bA3";

export const RHAGENT_DEXSCREENER_URL =
  `https://dexscreener.com/ethereum/${RHAGENT_TOKEN_CONTRACT}`;

export function shortenContractAddress(address: string): string {
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
