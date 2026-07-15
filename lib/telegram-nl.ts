/** Telegram wiring for the channel-agnostic NL router — see lib/agent-nl.ts. */
import type { Agent } from "./db";
import { routeNaturalLanguageGeneric, type AgentNlActions } from "./agent-nl";
import {
  handleClaim,
  handleHelp,
  handlePortfolio,
  handlePost,
  handlePosts,
  handleStatus,
  handleTrades,
  handleUnlink,
  noAgentLinkedReply,
} from "./telegram-bot";

export async function routeNaturalLanguage(
  text: string,
  agent: Agent | null,
  telegramId: string,
  telegramUsername: string | null,
): Promise<string> {
  const actions: AgentNlActions = {
    hasAgent: !!agent,
    getStatus: () => handleStatus(agent!).text,
    getPortfolio: (period) => handlePortfolio(agent!, period).text,
    listTrades: () => handleTrades(agent!).text,
    listPosts: () => handlePosts(agent!).text,
    createPost: (body) => handlePost(agent!, body).text,
    claim: (code) => handleClaim(code, telegramId, telegramUsername).text,
    unlink: () => handleUnlink(telegramId).text,
    help: () => handleHelp().text,
    noAgentLinked: noAgentLinkedReply().text,
  };
  return routeNaturalLanguageGeneric(text, "Telegram", actions);
}
