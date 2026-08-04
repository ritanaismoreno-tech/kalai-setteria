import { Router } from "express";
import { createTag, listTags } from "../services/tag.service.js";
import { requireAdminToken } from "./auth.middleware.js";

export const adminTagRouter = Router();
adminTagRouter.use(requireAdminToken);

adminTagRouter.get("/", async (_req, res) => {
  const rows = await listTags();
  res.json(rows);
});

adminTagRouter.post("/", async (req, res) => {
  const name = req.body?.name;
  const color = req.body?.color;
  if (typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  if (typeof color !== "string" || color.trim().length === 0) {
    res.status(400).json({ error: "color is required" });
    return;
  }
  const created = await createTag(name.trim(), color.trim());
  res.status(201).json(created);
});
