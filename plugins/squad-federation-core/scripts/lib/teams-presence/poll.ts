/**
 * Poll — Single poll cycle that checks Teams and executes instructions.
 *
 * Pure function of config + dependencies. Stateless between calls.
 */

import { AcpSession } from './acp-session.js';
import { getGraphToken, fetchMessages, replyToMessage, type TeamsConfig } from './graph-client.js';
import { WatermarkStore } from './watermark.js';

export interface PollDeps {
  teamsConfig: TeamsConfig;
  federationName: string;
  acp: AcpSession;
  watermark: WatermarkStore;
  log: (msg: string) => void;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function pollCycle(deps: PollDeps): Promise<number> {
  const { teamsConfig, federationName, acp, watermark, log } = deps;

  if (!acp.isAlive) {
    throw new Error('ACP process is dead — cannot process messages');
  }

  // Initialize watermark on first run (don't replay history)
  if (watermark.initializeIfNeeded()) {
    log('📌 Watermark initialized to now');
    return 0;
  }

  const wm = watermark.load()!;
  const token = getGraphToken();
  const messages = await fetchMessages(token, teamsConfig, wm.lastSeenTimestamp);
  if (messages.length === 0) return 0;

  // Filter for messages addressing the federation persona
  const handle = `@${federationName}`.toLowerCase();
  const relevant = messages.filter(m => {
    const text = stripHtml(m.body?.content || '').toLowerCase();
    return text.includes(handle);
  });

  if (relevant.length === 0) {
    // Advance watermark past irrelevant messages
    const newest = messages[0];
    watermark.save({ lastSeenTimestamp: newest.createdDateTime, lastSeenMessageId: newest.id });
    return 0;
  }

  log(`📬 Found ${relevant.length} message(s) addressing @${federationName}`);
  const escapedName = escapeRegExp(federationName);

  // Process oldest first
  for (const msg of relevant.reverse()) {
    const rawText = stripHtml(msg.body.content);
    const instruction = rawText.replace(new RegExp(`@${escapedName}`, 'gi'), '').trim();
    const sender = msg.from?.user?.displayName || 'someone';

    log(`💬 ${sender}: ${instruction.slice(0, 100)}`);

    // Acknowledge (fresh token in case previous execution was slow)
    let replyToken = getGraphToken();
    try {
      await replyToMessage(
        replyToken, teamsConfig, msg.id,
        `👋 Got it, ${sender}. Working on: "${instruction.slice(0, 100)}"...`
      );
    } catch (err) {
      log(`⚠️  Failed to acknowledge: ${(err as Error).message}`);
    }

    // Execute via ACP
    let success = false;
    try {
      const response = await acp.prompt(
        `The user "${sender}" sent this instruction via Teams: "${instruction}"\n\n` +
        `Execute it. Be concise in your response — it will be posted back to Teams.`
      );

      replyToken = getGraphToken();
      const reply = response.slice(0, 4000) || '✅ Done (no output)';
      await replyToMessage(replyToken, teamsConfig, msg.id, reply);
      log(`✅ Replied to ${sender}`);
      success = true;
    } catch (err) {
      const errMsg = `❌ Failed: ${(err as Error).message}`;
      log(errMsg);
      try {
        replyToken = getGraphToken();
        await replyToMessage(replyToken, teamsConfig, msg.id, errMsg);
      } catch { /* best-effort */ }
    }

    // Only advance watermark on success
    if (success) {
      watermark.save({ lastSeenTimestamp: msg.createdDateTime, lastSeenMessageId: msg.id });
    }
  }

  return relevant.length;
}
