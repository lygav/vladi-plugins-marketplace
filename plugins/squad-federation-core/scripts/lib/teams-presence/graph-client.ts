/**
 * GraphClient — Microsoft Graph API helper for Teams channel messages.
 *
 * Uses `az account get-access-token` for auth (no SDK dependency).
 * Provides typed methods for reading and replying to channel messages.
 */

import { execSync } from 'child_process';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

export interface TeamsMessage {
  id: string;
  createdDateTime: string;
  body: { content: string; contentType: string };
  from?: { user?: { displayName: string; id: string } };
}

export interface TeamsConfig {
  teamId: string;
  channelId: string;
}

export function getGraphToken(): string {
  try {
    return execSync(
      'az account get-access-token --resource https://graph.microsoft.com --query accessToken -o tsv',
      { encoding: 'utf-8', timeout: 10_000 }
    ).trim();
  } catch (err) {
    throw new Error(`Failed to get Graph token — is 'az' logged in? ${(err as Error).message}`);
  }
}

async function graphGet(token: string, path: string): Promise<any> {
  const resp = await fetch(`${GRAPH_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Graph GET ${path} failed (${resp.status}): ${body.slice(0, 200)}`);
  }
  return resp.json();
}

async function graphPost(token: string, path: string, body: unknown): Promise<any> {
  const resp = await fetch(`${GRAPH_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Graph POST ${path} failed (${resp.status}): ${text.slice(0, 200)}`);
  }
  return resp.json();
}

export async function fetchMessages(
  token: string,
  config: TeamsConfig,
  afterTimestamp?: string
): Promise<TeamsMessage[]> {
  const { teamId, channelId } = config;
  const url = `/teams/${teamId}/channels/${channelId}/messages?$top=20&$orderby=createdDateTime desc`;
  const data = await graphGet(token, url);
  let messages: TeamsMessage[] = data.value || [];

  if (afterTimestamp) {
    const watermarkTime = new Date(afterTimestamp).getTime();
    messages = messages.filter(m => new Date(m.createdDateTime).getTime() > watermarkTime);
  }

  return messages;
}

export async function replyToMessage(
  token: string,
  config: TeamsConfig,
  messageId: string,
  content: string
): Promise<void> {
  const { teamId, channelId } = config;
  await graphPost(
    token,
    `/teams/${teamId}/channels/${channelId}/messages/${messageId}/replies`,
    { body: { content, contentType: 'text' } }
  );
}
