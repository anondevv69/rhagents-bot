/**
 * Discord bot adapter — maps Discord.js events to the platform-agnostic router.
 */
import {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Interaction,
  type Message,
} from "discord.js";
import { handleMessage, type BotResponse } from "../commands/router.js";
import { env } from "../env.js";

export function createDiscordBot(): Client | null {
  if (!env.discordBotToken) return null;

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  client.on("ready", () => {
    console.log(`[discord] Logged in as ${client.user?.tag}`);
  });

  // ─── Messages (commands + free-form) ───

  client.on("messageCreate", async (message: Message) => {
    if (message.author.bot) return;

    // Only respond in DMs or when mentioned
    const isDM = !message.guild;
    const isMentioned = message.mentions.has(client.user!);
    if (!isDM && !isMentioned) return;

    const text = message.content
      .replace(new RegExp(`<@!?${client.user!.id}>`, "g"), "")
      .trim();

    if (!text) return;

    const response = await handleMessage({
      platform: "discord",
      platformId: message.author.id,
      chatId: message.channel.id,
      text,
      username: message.author.username,
      displayName: message.author.displayName || undefined,
    });

    await sendDiscordResponse(message, response);
  });

  // ─── Button interactions ───

  client.on("interactionCreate", async (interaction: Interaction) => {
    if (!interaction.isButton()) return;

    const data = interaction.customId;
    if (data.startsWith("url:")) {
      await interaction.reply({ content: data.slice(4), ephemeral: true });
      return;
    }

    const response = await handleMessage({
      platform: "discord",
      platformId: interaction.user.id,
      chatId: interaction.channel?.id ?? interaction.user.id,
      text: data,
      username: interaction.user.username,
      displayName: interaction.user.displayName || undefined,
    });

    await interaction.reply({
      content: response.text,
      components: response.buttons ? buildDiscordComponents(response.buttons) : [],
    });
  });

  client.on("error", (err) => {
    console.error("[discord] Error:", err);
  });

  return client;
}

async function sendDiscordResponse(message: Message, response: BotResponse): Promise<void> {
  const opts: Record<string, unknown> = { content: response.text };
  if (response.buttons?.length) {
    opts.components = buildDiscordComponents(response.buttons);
  }
  await message.reply(opts);
}

function buildDiscordComponents(buttons: Array<{ label: string; action: string }>) {
  const row = new ActionRowBuilder<ButtonBuilder>();
  for (const btn of buttons.slice(0, 5)) {
    if (btn.action.startsWith("url:")) {
      row.addComponents(
        new ButtonBuilder()
          .setLabel(btn.label)
          .setStyle(ButtonStyle.Link)
          .setURL(btn.action.slice(4)),
      );
    } else {
      row.addComponents(
        new ButtonBuilder()
          .setLabel(btn.label)
          .setStyle(ButtonStyle.Primary)
          .setCustomId(btn.action),
      );
    }
  }
  return [row];
}
