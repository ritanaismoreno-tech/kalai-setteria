import { desc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { systemPrompts } from "../db/schema.js";

const CACHE_TTL_MS = 60_000;

let cached: { id: string; content: string } | null = null;
let cachedAt = 0;

export async function getActiveSystemPrompt(): Promise<{
  id: string;
  content: string;
}> {
  const now = Date.now();
  if (cached && now - cachedAt < CACHE_TTL_MS) {
    return cached;
  }

  const [active] = await db
    .select()
    .from(systemPrompts)
    .where(eq(systemPrompts.isActive, true))
    .orderBy(desc(systemPrompts.version))
    .limit(1);

  if (!active) {
    throw new Error("No active system prompt configured");
  }

  cached = { id: active.id, content: active.content };
  cachedAt = now;
  return cached;
}

export function invalidateSystemPromptCache() {
  cached = null;
  cachedAt = 0;
}

export async function setActiveSystemPrompt(
  content: string,
  createdBy?: string,
): Promise<void> {
  const [latest] = await db
    .select({ version: systemPrompts.version })
    .from(systemPrompts)
    .orderBy(desc(systemPrompts.version))
    .limit(1);

  const nextVersion = (latest?.version ?? 0) + 1;

  await db.transaction(async (tx) => {
    await tx
      .update(systemPrompts)
      .set({ isActive: false })
      .where(eq(systemPrompts.isActive, true));

    await tx.insert(systemPrompts).values({
      version: nextVersion,
      content,
      isActive: true,
      createdBy,
    });
  });

  invalidateSystemPromptCache();
}
