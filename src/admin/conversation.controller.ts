import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { contacts, conversations, messages } from "../db/schema.js";
import { setConversationPaused } from "../services/conversation.service.js";
import { requireAdminToken } from "./auth.middleware.js";

export const adminConversationRouter = Router();
adminConversationRouter.use(requireAdminToken);

adminConversationRouter.get("/", async (_req, res) => {
  const rows = await db
    .select({
      id: conversations.id,
      platform: conversations.platform,
      status: conversations.status,
      lastMessageAt: conversations.lastMessageAt,
      followUpsSent: conversations.followUpsSent,
      contactDisplayName: contacts.displayName,
      contactExternalId: contacts.externalId,
    })
    .from(conversations)
    .innerJoin(contacts, eq(conversations.contactId, contacts.id))
    .orderBy(desc(conversations.lastMessageAt));

  res.json(rows);
});

adminConversationRouter.get("/:id/messages", async (req, res) => {
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, req.params.id))
    .orderBy(messages.createdAt);

  res.json(rows);
});

adminConversationRouter.patch("/:id/pause", async (req, res) => {
  await setConversationPaused(req.params.id, true, req.body?.pausedBy);
  res.sendStatus(204);
});

adminConversationRouter.patch("/:id/resume", async (req, res) => {
  await setConversationPaused(req.params.id, false);
  res.sendStatus(204);
});
