import { Router } from "express";
import { z } from "zod";
import {
  listConversations,
  getConversationById,
  getHistory,
  pauseConversation,
  resumeConversation,
  setConversationStage,
} from "../services/conversation.service.js";
import { getTagsForConversations } from "../services/tag.service.js";
import { AppError } from "../lib/errors.js";

export const conversationRouter = Router();

conversationRouter.get("/conversations", async (_req, res) => {
  const conversations = await listConversations();
  const tagsByConversation = await getTagsForConversations(conversations.map((c) => c.id));

  res.json({
    conversations: conversations.map((c) => ({
      ...c,
      tags: tagsByConversation.get(c.id) ?? [],
    })),
  });
});

conversationRouter.get("/conversations/:id/messages", async (req, res) => {
  await getConversationById(req.params.id);
  const history = await getHistory(req.params.id, 200);
  res.json({ messages: history });
});

conversationRouter.patch("/conversations/:id/pause", async (req, res) => {
  const updated = await pauseConversation(req.params.id, "admin");
  res.json({ conversation: updated });
});

conversationRouter.patch("/conversations/:id/resume", async (req, res) => {
  const updated = await resumeConversation(req.params.id);
  res.json({ conversation: updated });
});

const stageSchema = z.object({
  stage: z.enum(["nuevos", "conversacion", "cualificados", "agendados", "perdidos"]),
});

conversationRouter.patch("/conversations/:id/stage", async (req, res) => {
  const parsed = stageSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError("stage inválido", 400);

  const updated = await setConversationStage(req.params.id, parsed.data.stage);
  res.json({ conversation: updated });
});
