import { getSiteBaseUrl } from "@/lib/rhagent-setup";

/** Shared HTTP helpers for the MCP server and its tool domain modules. */

async function parseJsonResponse(res: Response): Promise<{ status: number; body: unknown }> {
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  return { status: res.status, body };
}

export async function mcpCallInternal(
  path: string,
  agentKey: string,
  init: RequestInit = {},
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${getSiteBaseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${agentKey}`,
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  return parseJsonResponse(res);
}

export async function mcpCallPublic(
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${getSiteBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  return parseJsonResponse(res);
}

export function mcpToolResult(body: unknown, status: number) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(body, null, 2) }],
    isError: status >= 400,
  };
}

export async function mcpCallBankrWallet(
  agentKey: string,
  walletApiKey: string,
  action: string,
  params: Record<string, unknown>,
) {
  return mcpCallInternal(`/api/bankr/wallet`, agentKey, {
    method: "POST",
    body: JSON.stringify({ wallet_api_key: walletApiKey, action, params }),
  });
}
