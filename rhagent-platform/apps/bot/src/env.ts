import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const env = {
  // ─── Platform tokens ───
  telegramBotToken: required("TELEGRAM_BOT_TOKEN"),
  discordBotToken: optional("DISCORD_BOT_TOKEN"),
  discordApplicationId: optional("DISCORD_APPLICATION_ID"),

  // ─── Bankr ───
  bankrPartnerKey: required("BANKR_PARTNER_KEY"),
  bankrStarterCreditUsd: Number(optional("BANKR_STARTER_CREDIT_USD", "5")) || 5,
  bankrFundEth: optional("BANKR_FUND_ETH"),

  // ─── Database ───
  masterEncryptionKey: required("MASTER_ENCRYPTION_KEY"),
  databasePath: optional("DATABASE_PATH", "./data/rhagent.db"),

  // ─── LLM ───
  fallbackAnthropicApiKey: optional("FALLBACK_ANTHROPIC_API_KEY"),
  managedInferenceMessages: Number(optional("MANAGED_INFERENCE_MESSAGES", "25")) || 25,

  // ─── URLs ───
  dashboardUrl: optional("DASHBOARD_URL", "https://rhagent.bot").replace(/\/$/, ""),
  publicBaseUrl: optional("PUBLIC_BASE_URL"),
  webhookSecret: optional("WEBHOOK_SECRET"),

  // ─── Limits ───
  maxOrderUsd: Number(optional("MAX_ORDER_USD", "50")) || 50,
  maxToolIterations: Number(optional("MAX_TOOL_ITERATIONS", "20")) || 20,

  // ─── White-label ───
  brandName: optional("BRAND_NAME", "rhagent"),
  brandDomain: optional("BRAND_DOMAIN", "rhagent.bot"),

  port: Number(optional("PORT", "8090")) || 8090,
};

if (env.masterEncryptionKey.length < 16) {
  throw new Error("MASTER_ENCRYPTION_KEY must be at least 16 characters.");
}
