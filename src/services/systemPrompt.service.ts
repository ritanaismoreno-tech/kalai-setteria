import { desc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { systemPrompts } from "../db/schema.js";

const CACHE_TTL_MS = 60_000;
const FALLBACK_PROMPT =
  "Eres una setter que responde a leads por WhatsApp. Todavía no se ha configurado " +
  "el contenido real del programa — responde con amabilidad y pide disculpas por la demora, " +
  "un miembro del equipo continuará la conversación en breve.";

let cache: { content: string; cachedAt: number } | null = null;

export async function getActiveSystemPrompt(): Promise<string> {
  if (cache && Date.now() - cache.cachedAt < CACHE_TTL_MS) {
    return cache.content;
  }

  const [active] = await db
    .select()
    .from(systemPrompts)
    .where(eq(systemPrompts.isActive, true))
    .orderBy(desc(systemPrompts.version))
    .limit(1);

  const content = active?.content ?? FALLBACK_PROMPT;
  cache = { content, cachedAt: Date.now() };
  return content;
}

export function invalidateSystemPromptCache(): void {
  cache = null;
}

export async function listSystemPrompts() {
  return db.select().from(systemPrompts).orderBy(desc(systemPrompts.version));
}

export async function setActiveSystemPrompt(content: string, createdBy?: string) {
  const [latest] = await db
    .select({ version: systemPrompts.version })
    .from(systemPrompts)
    .orderBy(desc(systemPrompts.version))
    .limit(1);

  const nextVersion = (latest?.version ?? 0) + 1;

  await db.update(systemPrompts).set({ isActive: false }).where(eq(systemPrompts.isActive, true));

  const [created] = await db
    .insert(systemPrompts)
    .values({ version: nextVersion, content, isActive: true, createdBy })
    .returning();

  invalidateSystemPromptCache();
  return created;
}
