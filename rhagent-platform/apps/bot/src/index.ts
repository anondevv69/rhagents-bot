/**
 * rhagent-platform bot — entry point.
 * Starts Telegram + Discord bots and an Express health/webhook server.
 */
import express from "express";
import { createTelegramBot } from "./platforms/telegram.js";
import { createDiscordBot } from "./platforms/discord.js";
import { getDb } from "./db/schema.js";
import { env } from "./env.js";

async function main() {
  console.log(`[rhagent] Starting ${env.brandName} bot...`);

  // Init database
  getDb();
  console.log("[rhagent] Database initialized");

  // Start Telegram bot
  const telegram = createTelegramBot();

  if (env.publicBaseUrl && env.webhookSecret) {
    // Webhook mode (production)
    const webhookUrl = `${env.publicBaseUrl}/webhook/telegram`;
    await telegram.telegram.setWebhook(webhookUrl, { secret_token: env.webhookSecret });
    console.log(`[telegram] Webhook set: ${webhookUrl}`);
  } else {
    // Polling mode (development)
    telegram.launch();
    console.log("[telegram] Polling started");
  }

  // Start Discord bot
  const discord = createDiscordBot();
  if (discord) {
    await discord.login(env.discordBotToken);
    console.log("[discord] Bot started");
  }

  // Express server for webhooks + health
  const app = express();
  app.use(express.json());

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", brand: env.brandName, uptime: process.uptime() });
  });

  // Telegram webhook endpoint
  if (env.publicBaseUrl && env.webhookSecret) {
    app.post("/webhook/telegram", (req, res) => {
      const secret = req.headers["x-telegram-bot-api-secret-token"];
      if (secret !== env.webhookSecret) {
        res.status(401).json({ error: "unauthorized" });
        return;
      }
      telegram.handleUpdate(req.body).catch(console.error);
      res.json({ ok: true });
    });
  }

  // API endpoints for dashboard
  app.get("/api/user/:platform/:platformId", (req, res) => {
    const { findUser } = require("./db/users.js");
    const user = findUser(req.params.platform, req.params.platformId);
    if (!user) {
      res.status(404).json({ error: "user_not_found" });
      return;
    }
    // Never expose secrets
    res.json({ ...user, bankrApiKey: undefined });
  });

  app.listen(env.port, () => {
    console.log(`[rhagent] HTTP server on :${env.port}`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log("[rhagent] Shutting down...");
    telegram.stop("SIGTERM");
    discord?.destroy();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("[rhagent] Fatal:", err);
  process.exit(1);
});
