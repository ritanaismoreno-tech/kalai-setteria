import { and, eq, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { contacts, conversations } from "../db/schema.js";
import { getActiveSystemPrompt } from "./systemPrompt.service.js";
import { generateFollowUp } from "./claude.service.js";
import { loadHistory, sendAndPersistAssistantMessage } from "./conversation.service.js";
import { logger } from "../lib/logger.js";

const FOLLOW_UP_DELAY_HOURS = Number(process.env.FOLLOW_UP_DELAY_HOURS ?? 17);
const FOLLOW_UP_MAX_COUNT = Number(process.env.FOLLOW_UP_MAX_COUNT ?? 1);
const FOLLOW_UP_CHECK_INTERVAL_MINUTES = Number(
  process.env.FOLLOW_UP_CHECK_INTERVAL_MINUTES ?? 15,
);
const SESSION_WINDOW_HOURS = 24;

async function findConversationsDueForFollowUp() {
  const now = Date.now();
  const delayThreshold = new Date(now - FOLLOW_UP_DELAY_HOURS * 60 * 60 * 1000);
  const windowCutoff = new Date(now - SESSION_WINDOW_HOURS * 60 * 60 * 1000);

  const rows = await db
    .select({
      conversationId: conversations.id,
      platform: conversations.platform,
      externalUserId: contacts.externalId,
      lastInboundAt: conversations.lastInboundAt,
    })
    .from(conversations)
    .innerJoin(contacts, eq(conversations.contactId, contacts.id))
    .where(
      and(
        eq(conversations.status, "active"),
        isNotNull(conversations.lastInboundAt),
        // assistant replied last (lead hasn't responded since)
        sql`${conversations.lastMessageAt} > ${conversations.lastInboundAt}`,
        lt(conversations.followUpsSent, FOLLOW_UP_MAX_COUNT),
      ),
    );

  return rows.filter(
    (row) =>
      row.lastInboundAt !== null &&
      row.lastInboundAt <= delayThreshold &&
      row.lastInboundAt > windowCutoff,
  );
}

export async function runFollowUpCheck(): Promise<void> {
  const due = await findConversationsDueForFollowUp();

  for (const conversation of due) {
    try {
      const systemPrompt = await getActiveSystemPrompt();
      const history = await loadHistory(conversation.conversationId);

      const followUpText = await generateFollowUp(systemPrompt.content, history);

      await sendAndPersistAssistantMessage(
        conversation.conversationId,
        conversation.platform,
        conversation.externalUserId,
        followUpText,
        systemPrompt.id,
      );

      await db
        .update(conversations)
        .set({
          followUpsSent: sql`${conversations.followUpsSent} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(conversations.id, conversation.conversationId));

      logger.info(
        { conversationId: conversation.conversationId },
        "Sent follow-up message",
      );
    } catch (error) {
      logger.error(
        { error, conversationId: conversation.conversationId },
        "Failed to send follow-up",
      );
    }
  }
}

export function startFollowUpScheduler(): void {
  const intervalMs = FOLLOW_UP_CHECK_INTERVAL_MINUTES * 60 * 1000;
  setInterval(() => {
    runFollowUpCheck().catch((error) =>
      logger.error({ error }, "Follow-up scheduler tick failed"),
    );
  }, intervalMs);
  logger.info(
    { intervalMinutes: FOLLOW_UP_CHECK_INTERVAL_MINUTES },
    "Follow-up scheduler started",
  );
}
