import { eq, and, asc } from "drizzle-orm";
import { db } from "../db/client.js";
import { tags, conversationTags } from "../db/schema.js";

export async function listTags() {
  return db.select().from(tags).orderBy(asc(tags.name));
}

export async function createTag(name: string, color: string) {
  const [created] = await db.insert(tags).values({ name, color }).returning();
  return created;
}

export async function applyTag(conversationId: string, tagId: string) {
  await db
    .insert(conversationTags)
    .values({ conversationId, tagId })
    .onConflictDoNothing();
}

export async function removeTag(conversationId: string, tagId: string) {
  await db
    .delete(conversationTags)
    .where(and(eq(conversationTags.conversationId, conversationId), eq(conversationTags.tagId, tagId)));
}

export async function getTagsForConversations(conversationIds: string[]) {
  if (conversationIds.length === 0) return new Map<string, { id: string; name: string; color: string }[]>();

  const rows = await db
    .select({
      conversationId: conversationTags.conversationId,
      id: tags.id,
      name: tags.name,
      color: tags.color,
    })
    .from(conversationTags)
    .innerJoin(tags, eq(conversationTags.tagId, tags.id));

  const byConversation = new Map<string, { id: string; name: string; color: string }[]>();
  for (const row of rows) {
    if (!conversationIds.includes(row.conversationId)) continue;
    const list = byConversation.get(row.conversationId) ?? [];
    list.push({ id: row.id, name: row.name, color: row.color });
    byConversation.set(row.conversationId, list);
  }
  return byConversation;
}
