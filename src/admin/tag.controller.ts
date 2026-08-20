import { Router } from "express";
import { z } from "zod";
import { listTags, createTag, applyTag, removeTag } from "../services/tag.service.js";
import { AppError } from "../lib/errors.js";

export const tagRouter = Router();

tagRouter.get("/tags", async (_req, res) => {
  res.json({ tags: await listTags() });
});

const createTagSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().min(1).max(16),
});

tagRouter.post("/tags", async (req, res) => {
  const parsed = createTagSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError("name/color inválidos", 400);

  const tag = await createTag(parsed.data.name, parsed.data.color);
  res.status(201).json({ tag });
});

tagRouter.post("/conversations/:id/tags", async (req, res) => {
  const parsed = z.object({ tagId: z.string().uuid() }).safeParse(req.body);
  if (!parsed.success) throw new AppError("tagId inválido", 400);

  await applyTag(req.params.id, parsed.data.tagId);
  res.status(201).json({ ok: true });
});

tagRouter.delete("/conversations/:id/tags/:tagId", async (req, res) => {
  await removeTag(req.params.id, req.params.tagId);
  res.json({ ok: true });
});
