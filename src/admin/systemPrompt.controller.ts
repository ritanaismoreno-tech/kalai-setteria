import { Router } from "express";
import { z } from "zod";
import { listSystemPrompts, setActiveSystemPrompt } from "../services/systemPrompt.service.js";
import { AppError } from "../lib/errors.js";

export const systemPromptRouter = Router();

systemPromptRouter.get("/system-prompt", async (_req, res) => {
  const prompts = await listSystemPrompts();
  const active = prompts.find((p) => p.isActive) ?? null;
  res.json({ active, history: prompts });
});

const updateSchema = z.object({ content: z.string().min(1) });

systemPromptRouter.patch("/system-prompt", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError("content inválido", 400);

  const created = await setActiveSystemPrompt(parsed.data.content, "admin");
  res.json({ active: created });
});
