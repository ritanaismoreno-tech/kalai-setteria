import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  boolean,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const platformEnum = pgEnum("platform", ["whatsapp", "instagram"]);
export const conversationStatusEnum = pgEnum("conversation_status", [
  "active",
  "paused",
  "closed",
]);
export const messageRoleEnum = pgEnum("message_role", [
  "user",
  "assistant",
  "system_note",
]);
export const messageDirectionEnum = pgEnum("message_direction", [
  "inbound",
  "outbound",
]);
export const conversationStageEnum = pgEnum("conversation_stage", [
  "nuevos",
  "conversacion",
  "cualificados",
  "agendados",
  "perdidos",
]);

export const systemPrompts = pgTable("system_prompts", {
  id: uuid("id").primaryKey().defaultRandom(),
  version: integer("version").notNull(),
  content: text("content").notNull(),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdBy: text("created_by"),
});

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    platform: platformEnum("platform").notNull(),
    externalId: text("external_id").notNull(),
    displayName: text("display_name"),
    phoneNumber: text("phone_number"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("contacts_platform_external_id_idx").on(
      table.platform,
      table.externalId,
    ),
  ],
);

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  contactId: uuid("contact_id")
    .notNull()
    .references(() => contacts.id),
  platform: platformEnum("platform").notNull(),
  status: conversationStatusEnum("status").notNull().default("active"),
  stage: conversationStageEnum("stage").notNull().default("nuevos"),
  pausedAt: timestamp("paused_at", { withTimezone: true }),
  pausedBy: text("paused_by"),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
  lastInboundAt: timestamp("last_inbound_at", { withTimezone: true }),
  followUpsSent: integer("follow_ups_sent").notNull().default(0),
  systemPromptVersionId: uuid("system_prompt_version_id").references(
    () => systemPrompts.id,
  ),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id),
  role: messageRoleEnum("role").notNull(),
  content: text("content").notNull(),
  platformMessageId: text("platform_message_id"),
  direction: messageDirectionEnum("direction").notNull(),
  rawPayload: jsonb("raw_payload"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  color: text("color").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const conversationTags = pgTable(
  "conversation_tags",
  {
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id),
    appliedAt: timestamp("applied_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("conversation_tags_pair_idx").on(
      table.conversationId,
      table.tagId,
    ),
  ],
);

export const processedWebhookEvents = pgTable(
  "processed_webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    platformMessageId: text("platform_message_id").notNull(),
    platform: platformEnum("platform").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("processed_webhook_events_platform_message_id_idx").on(
      table.platformMessageId,
    ),
  ],
);
