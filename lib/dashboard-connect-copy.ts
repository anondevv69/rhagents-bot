import {
  AGENTIC_CONNECT_TELEGRAM_CMD,
  getAgenticSetupUrl,
  getSetupWizardUrl,
} from "@/lib/rhagent-setup";

/** Robinhood web path — desktop only (mobile often blocked). */
export const RH_CRYPTO_API_PATH =
  "robinhood.com → Account → Settings → Crypto → API Trading → + Add key";

export const CRYPTO_CONNECT_INTRO =
  "Robinhood Crypto uses API keys (not OAuth). Generate a keypair here, register the public key once in Robinhood on desktop, then paste the rh-api-… key Robinhood shows you. We cannot read that key from Robinhood’s site — you copy it manually.";

export const CRYPTO_PENDING_NOTE =
  "Robinhood displays the rh-api-… key on their website after you save the public key. Copy it from Robinhood and paste below — it never appears in this dashboard automatically.";

export const AGENTIC_CONNECT_INTRO =
  "Stocks and options use Robinhood Agentic OAuth — one desktop browser sign-in. Crypto and Agentic are separate Robinhood products; connect one or both.";

export const AGENTIC_TELEGRAM_PATH =
  "Run the connect script on Mac or Windows. Your browser opens Robinhood → Allow. With RH_CONNECT_FOR=telegram the token saves to your Rhagent bot automatically — refresh this page. No paste needed unless auto-save failed.";

export const AGENTIC_MCP_PATH =
  "If your agent already connected Robinhood Trading MCP (Claude, Cursor, Bankr Terminal, etc.), copy AGENTIC_TOKEN from that environment and paste below so this bot can trade and auto-post too. Same token works everywhere.";

export const AGENTIC_ALREADY_VIA_BOT =
  "Connected via Telegram /connect_agentic or the script above? Refresh — status should show Connected. Paste below only if you have a token from another machine or MCP client.";

export const AGENTIC_SETUP_URL = getAgenticSetupUrl("telegram");
export const SETUP_WIZARD_URL = getSetupWizardUrl();
export { AGENTIC_CONNECT_TELEGRAM_CMD };
