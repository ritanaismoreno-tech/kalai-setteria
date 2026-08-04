import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import { conversationTags, tags } from "../db/schema.js";

export async function listTags() {
  return db.select().from(tags).orderBy(tags.createdAt);
}

export async function createTag(name: string, color: string) {
  const [created] = await db.insert(tags).values({ name, color }).returning();
  return created;
}

export async function applyTagToConversation(conversationId: string, tagId: string) {
  await db
    .insert(conversationTags)
    .values({ conversationId, tagId })
    .onConflictDoNothing();
}

export async function removeTagFromConversation(conversationId: string, tagId: string) {
  await db
    .delete(conversationTags)
    .where(
      and(
        eq(conversationTags.conversationId, conversationId),
        eq(conversationTags.tagId, tagId),
      ),
    );
}

export async function getTagsForConversations(
  conversationIds: string[],
): Promise<Record<string, { id: string; name: string; color: string }[]>> {
  if (conversationIds.length === 0) return {};

  const rows = await db
    .select({
      conversationId: conversationTags.conversationId,
      tagId: tags.id,
      name: tags.name,
      color: tags.color,
    })
    .from(conversationTags)
    .innerJoin(tags, eq(conversationTags.tagId, tags.id))
    .where(inArray(conversationTags.conversationId, conversationIds));

  const result: Record<string, { id: string; name: string; color: string }[]> = {};
  for (const row of rows) {
    if (!result[row.conversationId]) result[row.conversationId] = [];
    result[row.conversationId].push({ id: row.tagId, name: row.name, color: row.color });
  }
  return result;
}
