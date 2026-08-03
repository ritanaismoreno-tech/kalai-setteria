import { Router } from "express";
import { getActiveSystemPrompt, setActiveSystemPrompt } from "../services/systemPrompt.service.js";
import { requireAdminToken } from "./auth.middleware.js";

export const adminSystemPromptRouter = Router();
adminSystemPromptRouter.use(requireAdminToken);

adminSystemPromptRouter.get("/", async (_req, res) => {
  const active = await getActiveSystemPrompt();
  res.json(active);
});

adminSystemPromptRouter.patch("/", async (req, res) => {
  const content = req.body?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    res.status(400).json({ error: "content is required" });
    return;
  }

  await setActiveSystemPrompt(content, req.body?.createdBy);
  res.sendStatus(204);
});
