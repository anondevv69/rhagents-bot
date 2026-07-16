/** Platform-specific setup commands and copy for the setup wizard. */

import { AGENTIC_CONNECT_SCRIPT_URL, CRYPTO_KEYGEN_SCRIPT_URL } from "@/lib/rhagent-setup";

export type SetupPlatform = "mac" | "windows";

export const CRYPTO_KEYGEN_CMD_MAC =
  `python3 -m pip install pynacl && curl -fsSL ${CRYPTO_KEYGEN_SCRIPT_URL} | python3`;

export const CRYPTO_KEYGEN_CMD_WIN =
  `py -m pip install pynacl && curl -fsSL ${CRYPTO_KEYGEN_SCRIPT_URL} | py`;

export function detectSetupPlatform(): SetupPlatform {
  if (typeof navigator === "undefined") return "mac";
  const platform = navigator.platform || "";
  const ua = navigator.userAgent || "";
  if (/Win/i.test(platform) || /Windows/i.test(ua)) return "windows";
  return "mac";
}

export function getCryptoKeygenCmd(platform: SetupPlatform): string {
  return platform === "windows" ? CRYPTO_KEYGEN_CMD_WIN : CRYPTO_KEYGEN_CMD_MAC;
}

export const CRYPTO_KEYGEN_HINT: Record<SetupPlatform, string> = {
  mac: "Terminal.app. If python3 is missing: brew install python3",
  windows:
    "PowerShell or Git Bash. If py fails, install Python from python.org (check “Add to PATH”), then use python -m pip … | python",
};

export const AGENTIC_SHELL_HINT: Record<SetupPlatform, string> = {
  mac: "Terminal.app — requires Node.js + git",
  windows: "Git Bash or WSL — requires Node.js + git (Git for Windows includes Bash)",
};

export const CRYPTO_WHAT_FOR =
  "Connects your agent to Robinhood Crypto API Trading so it can buy/sell BTC, DOGE, ETH, and other listed pairs in your Robinhood Crypto account. You generate an Ed25519 keypair, register the public key in Robinhood web, and keep the private key in your agent env only.";

export const CRYPTO_ALREADY_HAVE =
  "Already have a keypair and rh-api-… from Robinhood? Skip keygen — add the three env vars below.";

export const AGENTIC_WHAT_FOR =
  "Connects your agent to a Robinhood Agentic account for stocks and options (quotes, portfolio, orders, option chains, scans). Trades settle in that Agentic account in the Robinhood app — not on rhagent.bot.";

export const AGENTIC_ALREADY_HAVE =
  "Already have AGENTIC_TOKEN? Paste it into env vars and connect MCP — skip bankr login and rh-connect.sh.";

export const CRYPTO_ENV_VARS = `RH_API_KEY = rh-api-...
RH_PRIVATE_KEY_BASE64 = (private key from keygen — or one you already saved)
RH_GATEWAY_SECRET = uniqueissomethingimtesting`;

/** Public shared door code for the RH Wallet crypto gateway — same for everyone (not a personal secret). */
export const RH_GATEWAY_SECRET_NOTE =
  "RH_GATEWAY_SECRET is the public gateway door code (must be lowercase). Same value for everyone — not your Robinhood key, and not something you generate.";

