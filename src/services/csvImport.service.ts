import { parse } from "csv-parse/sync";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { trainingConversationBatches, trainingMessages } from "../db/schema.js";
import { AppError } from "../lib/errors.js";

// Formato esperado (el mismo "pipeline generator" que ya se usa en Enformix):
// Lead Name, Pipeline Stage, Direction, Sent By, Message Date, Message Text
const EXPECTED_COLUMNS = ["Lead Name", "Pipeline Stage", "Direction", "Sent By", "Message Date", "Message Text"];

interface CsvRow {
  leadName: string;
  pipelineStage: string | null;
  direction: string | null;
  sentBy: string | null;
  messageDate: Date | null;
  messageText: string;
}

function findColumn(headers: string[], target: string): string | undefined {
  const normalizedTarget = target.toLowerCase().replace(/\s+/g, "");
  return headers.find((h) => h.toLowerCase().replace(/\s+/g, "") === normalizedTarget);
}

function parseCsv(csvText: string): CsvRow[] {
  let records: Record<string, string>[];
  try {
    records = parse(csvText, { columns: true, skip_empty_lines: true, trim: true });
  } catch {
    throw new AppError("No se pudo leer el CSV. Verifica el formato del archivo.", 400);
  }

  if (records.length === 0) {
    throw new AppError("El CSV está vacío", 400);
  }

  const headers = Object.keys(records[0]);
  const leadNameCol = findColumn(headers, "Lead Name");
  const messageTextCol = findColumn(headers, "Message Text");

  if (!leadNameCol || !messageTextCol) {
    throw new AppError(
      `El CSV debe tener al menos las columnas "Lead Name" y "Message Text" (formato esperado: ${EXPECTED_COLUMNS.join(", ")})`,
      400,
    );
  }

  const stageCol = findColumn(headers, "Pipeline Stage");
  const directionCol = findColumn(headers, "Direction");
  const sentByCol = findColumn(headers, "Sent By");
  const dateCol = findColumn(headers, "Message Date");

  return records
    .filter((row) => row[leadNameCol]?.trim() && row[messageTextCol]?.trim())
    .map((row) => {
      const rawDate = dateCol ? row[dateCol] : undefined;
      const parsedDate = rawDate ? new Date(rawDate) : null;

      return {
        leadName: row[leadNameCol].trim(),
        pipelineStage: stageCol ? (row[stageCol]?.trim() ?? null) : null,
        direction: directionCol ? (row[directionCol]?.trim() ?? null) : null,
        sentBy: sentByCol ? (row[sentByCol]?.trim() ?? null) : null,
        messageDate: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null,
        messageText: row[messageTextCol].trim(),
      };
    });
}

export async function createBatchFromCsv(csvText: string, fileName?: string) {
  const rows = parseCsv(csvText);
  const distinctLeads = new Set(rows.map((r) => r.leadName));

  const [batch] = await db
    .insert(trainingConversationBatches)
    .values({
      fileName,
      totalRows: rows.length,
      distinctLeadCount: distinctLeads.size,
      status: "uploaded",
    })
    .returning();

  if (rows.length > 0) {
    await db.insert(trainingMessages).values(
      rows.map((row) => ({
        batchId: batch.id,
        leadName: row.leadName,
        pipelineStage: row.pipelineStage,
        direction: row.direction,
        sentBy: row.sentBy,
        messageDate: row.messageDate,
        messageText: row.messageText,
      })),
    );
  }

  const distinctStages = [...new Set(rows.map((r) => r.pipelineStage).filter((s): s is string => Boolean(s)))];

  return { batch, distinctStages };
}

export async function getDistinctStages(batchId: string): Promise<string[]> {
  const rows = await db
    .select({ pipelineStage: trainingMessages.pipelineStage })
    .from(trainingMessages)
    .where(eq(trainingMessages.batchId, batchId));

  return [...new Set(rows.map((r) => r.pipelineStage).filter((s): s is string => Boolean(s)))];
}

export type OutcomeCategory = "reached_call" | "not_scheduled" | "ignored";

export async function applyStageMap(batchId: string, stageMap: Record<string, OutcomeCategory>) {
  const rows = await db
    .select({ leadName: trainingMessages.leadName, pipelineStage: trainingMessages.pipelineStage })
    .from(trainingMessages)
    .where(eq(trainingMessages.batchId, batchId));

  const outcomeByLead = new Map<string, OutcomeCategory>();

  for (const row of rows) {
    const category = row.pipelineStage ? stageMap[row.pipelineStage] : undefined;
    if (!category) continue;

    const current = outcomeByLead.get(row.leadName);
    // Prioridad: si alguna vez llegó a "reached_call", eso manda aunque haya pasado por otras etapas antes.
    if (current === "reached_call") continue;
    if (category === "reached_call" || !current) {
      outcomeByLead.set(row.leadName, category);
    }
  }

  for (const [leadName, outcome] of outcomeByLead) {
    await db
      .update(trainingMessages)
      .set({ outcome })
      .where(and(eq(trainingMessages.batchId, batchId), eq(trainingMessages.leadName, leadName)));
  }

  await db
    .update(trainingConversationBatches)
    .set({ stageMap, status: "mapped" })
    .where(eq(trainingConversationBatches.id, batchId));

  return getBatchSummary(batchId);
}

export async function listBatches() {
  return db.select().from(trainingConversationBatches).orderBy(trainingConversationBatches.uploadedAt);
}

export async function getBatchSummary(batchId: string) {
  const rows = await db
    .select({ leadName: trainingMessages.leadName, outcome: trainingMessages.outcome })
    .from(trainingMessages)
    .where(eq(trainingMessages.batchId, batchId));

  const leadOutcomes = new Map<string, string>();
  for (const row of rows) leadOutcomes.set(row.leadName, row.outcome);

  const counts = { reached_call: 0, not_scheduled: 0, ignored: 0, unmapped: 0 };
  for (const outcome of leadOutcomes.values()) {
    counts[outcome as keyof typeof counts] += 1;
  }

  return { batchId, leadCount: leadOutcomes.size, counts };
}
