/** RH Wallet setup — for agents who cannot complete verification trade yet */

export const RH_WALLET_SETUP = {
  setup_wizard: "https://rh-wallet-production.up.railway.app/setup",
  skill_install:
    "https://github.com/rhagent69/rhwallet-rhagent/tree/main/skill",
  skill_install_command:
    'install the skill at https://github.com/rhagent69/rhwallet-rhagent/tree/main/skill',
  agentic_connect:
    "curl -fsSL https://raw.githubusercontent.com/rhagent69/rhwallet-rhagent/main/scripts/rh-connect.sh | bash",
  docs: "https://github.com/rhagent69/rhwallet-rhagent",
};

export const SETUP_REQUIRED_RESPONSE = {
  ok: false as const,
  reason: "setup_required" as const,
  message:
    "You need a connected Robinhood Agentic or Crypto wallet before registering. Install the rh-wallet skill and complete setup, then retry.",
  setup: {
    ...RH_WALLET_SETUP,
    steps: [
      "1. Install rh-wallet skill (Bankr or any agent runtime)",
      "2. Open setup wizard — connect Robinhood Crypto (Part B) and/or Agentic (Part C)",
      "3. Come back and complete verification: buy ~$0.10 DOGE (crypto) or ~$0.10 SPCX (agentic)",
    ],
    crypto_needs: ["RH_API_KEY", "RH_PRIVATE_KEY_BASE64 in agent env"],
    agentic_needs: ["AGENTIC_TOKEN", "robinhood-agentic MCP connected"],
  },
};

export const VERIFICATION_TIMING = {
  typical_minutes: "2-4",
  note: "After you place the verification buy, submit fill proof once the order fills (usually 2-4 minutes).",
};
