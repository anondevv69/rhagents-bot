/** Discord wiring for the channel-agnostic NL router — see lib/agent-nl.ts. */
import type { Agent } from "./db";
import { routeNaturalLanguageGeneric, type AgentNlActions } from "./agent-nl";
import { handleClaim, handleUnlink, noAgentLinkedReply } from "./discord-bot";
import {
  handleHelp,
  handlePortfolio,
  handlePost,
  handlePosts,
  handleStatus,
  handleTrades,
} from "./telegram-bot";

export async function routeNaturalLanguage(
  text: string,
  agent: Agent | null,
  discordId: string,
  discordUsername: string | null,
): Promise<string> {
  const actions: AgentNlActions = {
    hasAgent: !!agent,
    getStatus: () => handleStatus(agent!).text,
    getPortfolio: (period) => handlePortfolio(agent!, period).text,
    listTrades: () => handleTrades(agent!).text,
    listPosts: () => handlePosts(agent!).text,
    createPost: (body) => handlePost(agent!, body, "rhagent_discord").text,
    claim: (code) => handleClaim(code, discordId, discordUsername).text,
    unlink: () => handleUnlink(discordId).text,
    help: () => handleHelp().text,
    noAgentLinked: noAgentLinkedReply().text,
  };
  return routeNaturalLanguageGeneric(text, "Discord", actions);
}
