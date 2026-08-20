import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { contacts, conversations, messages } from "../db/schema.js";
import { NotFoundError } from "../lib/errors.js";

export async function findOrCreateContact(params: {
  platform: "whatsapp" | "instagram";
  externalId: string;
  displayName?: string;
  phoneNumber?: string;
}) {
  const [existing] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.platform, params.platform), eq(contacts.externalId, params.externalId)));

  if (existing) return existing;

  const [created] = await db
    .insert(contacts)
    .values({
      platform: params.platform,
      externalId: params.externalId,
      displayName: params.displayName,
      phoneNumber: params.phoneNumber,
    })
    .returning();

  return created;
}

export async function findOrCreateConversation(contactId: string, platform: "whatsapp" | "instagram") {
  const [existing] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.contactId, contactId), eq(conversations.platform, platform)));

  if (existing) return existing;

  const [created] = await db
    .insert(conversations)
    .values({ contactId, platform })
    .returning();

  return created;
}

export async function getConversationById(id: string) {
  const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
  if (!conversation) throw new NotFoundError("Conversación no encontrada");
  return conversation;
}

export async function persistMessage(params: {
  conversationId: string;
  role: "user" | "assistant" | "system_note";
  content: string;
  direction: "inbound" | "outbound";
  platformMessageId?: string;
  rawPayload?: unknown;
}) {
  const [created] = await db
    .insert(messages)
    .values({
      conversationId: params.conversationId,
      role: params.role,
      content: params.content,
      direction: params.direction,
      platformMessageId: params.platformMessageId,
      rawPayload: params.rawPayload,
    })
    .returning();

  const now = new Date();
  await db
    .update(conversations)
    .set({
      lastMessageAt: now,
      ...(params.direction === "inbound" ? { lastInboundAt: now, followUpsSent: 0 } : {}),
      updatedAt: now,
    })
    .where(eq(conversations.id, params.conversationId));

  return created;
}

export async function getHistory(conversationId: string, limit = 20) {
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(limit);

  return rows.reverse();
}

export async function listConversations() {
  return db
    .select({
      id: conversations.id,
      status: conversations.status,
      stage: conversations.stage,
      platform: conversations.platform,
      lastMessageAt: conversations.lastMessageAt,
      lastInboundAt: conversations.lastInboundAt,
      createdAt: conversations.createdAt,
      contact: {
        id: contacts.id,
        displayName: contacts.displayName,
        phoneNumber: contacts.phoneNumber,
        externalId: contacts.externalId,
      },
    })
    .from(conversations)
    .innerJoin(contacts, eq(conversations.contactId, contacts.id))
    .orderBy(desc(conversations.lastMessageAt));
}

export async function pauseConversation(id: string, pausedBy?: string) {
  await getConversationById(id);
  const [updated] = await db
    .update(conversations)
    .set({ status: "paused", pausedAt: new Date(), pausedBy, updatedAt: new Date() })
    .where(eq(conversations.id, id))
    .returning();
  return updated;
}

export async function resumeConversation(id: string) {
  await getConversationById(id);
  const [updated] = await db
    .update(conversations)
    .set({ status: "active", pausedAt: null, pausedBy: null, updatedAt: new Date() })
    .where(eq(conversations.id, id))
    .returning();
  return updated;
}

export async function setConversationStage(
  id: string,
  stage: "nuevos" | "conversacion" | "cualificados" | "agendados" | "perdidos",
) {
  await getConversationById(id);
  const [updated] = await db
    .update(conversations)
    .set({ stage, updatedAt: new Date() })
    .where(eq(conversations.id, id))
    .returning();
  return updated;
}
