import { Router } from "express";
import { z } from "zod";
import { getProgramConfig, saveSection, SECTION_KEYS, type SectionKey } from "../services/onboarding.service.js";
import {
  createBatchFromCsv,
  getDistinctStages,
  applyStageMap,
  listBatches,
  getBatchSummary,
  type OutcomeCategory,
} from "../services/csvImport.service.js";
import { generateSystemPromptDraft } from "../services/promptGeneration.service.js";
import { AppError } from "../lib/errors.js";

export const onboardingRouter = Router();

onboardingRouter.get("/onboarding/config", async (_req, res) => {
  res.json({ config: await getProgramConfig() });
});

onboardingRouter.put("/onboarding/config/:section", async (req, res) => {
  const section = req.params.section as SectionKey;
  if (!SECTION_KEYS.includes(section)) {
    throw new AppError(`Sección desconocida: ${section}`, 400);
  }
  if (typeof req.body !== "object" || req.body === null || Array.isArray(req.body)) {
    throw new AppError("El cuerpo debe ser un objeto con los campos de la sección", 400);
  }

  const config = await saveSection(section, req.body);
  res.json({ config });
});

const uploadSchema = z.object({
  fileName: z.string().optional(),
  csvText: z.string().min(1),
});

onboardingRouter.post("/onboarding/conversations", async (req, res) => {
  const parsed = uploadSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError("Falta csvText", 400);

  const { batch, distinctStages } = await createBatchFromCsv(parsed.data.csvText, parsed.data.fileName);
  res.status(201).json({ batch, distinctStages });
});

onboardingRouter.get("/onboarding/conversations", async (_req, res) => {
  const batches = await listBatches();
  const summaries = await Promise.all(batches.map((b) => getBatchSummary(b.id)));
  res.json({
    batches: batches.map((b, i) => ({ ...b, summary: summaries[i] })),
  });
});

onboardingRouter.get("/onboarding/conversations/:batchId/stages", async (req, res) => {
  res.json({ stages: await getDistinctStages(req.params.batchId) });
});

const mapSchema = z.object({
  stageMap: z.record(z.string(), z.enum(["reached_call", "not_scheduled", "ignored"])),
});

onboardingRouter.post("/onboarding/conversations/:batchId/map", async (req, res) => {
  const parsed = mapSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError("stageMap inválido", 400);

  const summary = await applyStageMap(req.params.batchId, parsed.data.stageMap as Record<string, OutcomeCategory>);
  res.json({ summary });
});

onboardingRouter.post("/onboarding/generate-prompt", async (_req, res) => {
  const draft = await generateSystemPromptDraft();
  res.json({ draft });
});
