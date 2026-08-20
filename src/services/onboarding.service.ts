import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { programConfig } from "../db/schema.js";

export const SECTION_KEYS = [
  "producto",
  "objetivoIa",
  "links",
  "personalidad",
  "objeciones",
  "clientes",
  "equipo",
  "testimonios",
  "formato",
  "followUps",
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

// program_config es una tabla singleton: una sola fila por instancia/cliente.
export async function getProgramConfig() {
  const [existing] = await db.select().from(programConfig).limit(1);
  if (existing) return existing;

  const [created] = await db.insert(programConfig).values({}).returning();
  return created;
}

export async function saveSection(section: SectionKey, data: unknown) {
  const current = await getProgramConfig();

  const [updated] = await db
    .update(programConfig)
    .set({ [section]: data, updatedAt: new Date() })
    .where(eq(programConfig.id, current.id))
    .returning();

  return updated;
}
