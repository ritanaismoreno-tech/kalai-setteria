import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { contacts, conversations, messages } from "../db/schema.js";
import type {
  NormalizedInboundMessage,
  Platform,
} from "../adapters/types.js";
import { markProcessedIfNew } from "./dedup.service.js";
import { getActiveSystemPrompt } from "./systemPrompt.service.js";
import { generateReply, type HistoryTurn } from "./claude.service.js";
import { sendWhatsAppMessage } from "../senders/whatsapp.sender.js";
import { logger } from "../lib/logger.js";

const HISTORY_MESSAGE_LIMIT = 20;

async function findOrCreateContact(platform: Platform, externalId: string, displayName: string | null) {
  const [existing] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.platform, platform), eq(contacts.externalId, externalId)));

  if (existing) return existing;

  const [created] = await db
    .insert(contacts)
    .values({ platform, externalId, displayName })
    .returning();

  return created;
}

async function findOrCreateConversation(contactId: string, platform: Platform) {
  const [existing] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.contactId, contactId));

  if (existing) return existing;

  const [created] = await db
    .insert(conversations)
    .values({ contactId, platform })
    .returning();

  return created;
}

export async function loadHistory(conversationId: string): Promise<HistoryTurn[]> {
  const rows = await db
    .select({ role: messages.role, content: messages.content })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(HISTORY_MESSAGE_LIMIT);

  return rows
    .reverse()
    .filter((row): row is { role: "user" | "assistant"; content: string } =>
      row.role === "user" || row.role === "assistant",
    );
}

async function sendReply(platform: Platform, externalUserId: string, text: string) {
  if (platform === "whatsapp") {
    return sendWhatsAppMessage(externalUserId, text);
  }
  throw new Error(`No sender implemented yet for platform: ${platform}`);
}

/**
 * Persists an assistant message, sends it on the given platform, and updates
 * the conversation's lastMessageAt/systemPromptVersionId. Shared by the
 * normal inbound-reply flow and the follow-up scheduler.
 */
export async function sendAndPersistAssistantMessage(
  conversationId: string,
  platform: Platform,
  externalUserId: string,
  replyText: string,
  systemPromptId: string,
): Promise<void> {
  const [assistantMessage] = await db
    .insert(messages)
    .values({
      conversationId,
      role: "assistant",
      content: replyText,
      direction: "outbound",
    })
    .returning();

  const sendResult = await sendReply(platform, externalUserId, replyText);

  await db
    .update(messages)
    .set({ platformMessageId: sendResult.platformMessageId })
    .where(eq(messages.id, assistantMessage.id));

  await db
    .update(conversations)
    .set({
      lastMessageAt: new Date(),
      systemPromptVersionId: systemPromptId,
      updatedAt: new Date(),
    })
    .where(eq(conversations.id, conversationId));
}

export async function processInboundMessage(inbound: NormalizedInboundMessage): Promise<void> {
  const isNew = await markProcessedIfNew(inbound.platform, inbound.platformMessageId);
  if (!isNew) {
    logger.info({ platformMessageId: inbound.platformMessageId }, "Duplicate webhook delivery, skipping");
    return;
  }

  const contact = await findOrCreateContact(
    inbound.platform,
    inbound.externalUserId,
    inbound.senderDisplayName,
  );
  const conversation = await findOrCreateConversation(contact.id, inbound.platform);

  await db.insert(messages).values({
    conversationId: conversation.id,
    role: "user",
    content: inbound.text ?? "[mensaje no soportado]",
    platformMessageId: inbound.platformMessageId,
    direction: "inbound",
    rawPayload: inbound.rawPayload,
  });

  await db
    .update(conversations)
    .set({
      lastMessageAt: inbound.timestamp,
      lastInboundAt: inbound.timestamp,
      followUpsSent: 0,
      updatedAt: new Date(),
    })
    .where(eq(conversations.id, conversation.id));

  if (conversation.status === "paused") {
    logger.info({ conversationId: conversation.id }, "Conversation is paused, not replying");
    return;
  }

  if (!inbound.isTextMessage || !inbound.text) {
    logger.info(
      { conversationId: conversation.id, messageType: "non-text" },
      "Non-text inbound message, skipping AI reply for v1",
    );
    return;
  }

  const systemPrompt = await getActiveSystemPrompt();
  const history = await loadHistory(conversation.id);

  const replyText = await generateReply(systemPrompt.content, history, inbound.text);

  const [assistantMessage] = await db
    .insert(messages)
    .values({
      conversationId: conversation.id,
      role: "assistant",
      content: replyText,
      direction: "outbound",
    })
    .returning();

  const sendResult = await sendReply(inbound.platform, inbound.externalUserId, replyText);

  await db
    .update(messages)
    .set({ platformMessageId: sendResult.platformMessageId })
    .where(eq(messages.id, assistantMessage.id));

  await db
    .update(conversations)
    .set({
      lastMessageAt: new Date(),
      systemPromptVersionId: systemPrompt.id,
      updatedAt: new Date(),
    })
    .where(eq(conversations.id, conversation.id));
}

export async function setConversationPaused(
  conversationId: string,
  paused: boolean,
  pausedBy?: string,
) {
  await db
    .update(conversations)
    .set({
      status: paused ? "paused" : "active",
      pausedAt: paused ? new Date() : null,
      pausedBy: paused ? (pausedBy ?? "admin") : null,
      updatedAt: new Date(),
    })
    .where(eq(conversations.id, conversationId));
}

const VALID_STAGES = [
  "nuevos",
  "conversacion",
  "cualificados",
  "agendados",
  "perdidos",
] as const;
export type ConversationStage = (typeof VALID_STAGES)[number];

export function isValidStage(value: unknown): value is ConversationStage {
  return typeof value === "string" && (VALID_STAGES as readonly string[]).includes(value);
}

export async function setConversationStage(
  conversationId: string,
  stage: ConversationStage,
): Promise<void> {
  await db
    .update(conversations)
    .set({ stage, updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));
}
