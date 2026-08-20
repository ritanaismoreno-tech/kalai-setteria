CREATE TYPE "public"."training_batch_status" AS ENUM('uploaded', 'mapped');--> statement-breakpoint
CREATE TYPE "public"."training_outcome" AS ENUM('unmapped', 'reached_call', 'not_scheduled', 'ignored');--> statement-breakpoint
CREATE TABLE "program_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"producto" jsonb,
	"objetivo_ia" jsonb,
	"links" jsonb,
	"personalidad" jsonb,
	"objeciones" jsonb,
	"clientes" jsonb,
	"equipo" jsonb,
	"testimonios" jsonb,
	"formato" jsonb,
	"follow_ups" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_conversation_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" text,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"distinct_lead_count" integer DEFAULT 0 NOT NULL,
	"stage_map" jsonb,
	"status" "training_batch_status" DEFAULT 'uploaded' NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"lead_name" text NOT NULL,
	"pipeline_stage" text,
	"direction" text,
	"sent_by" text,
	"message_date" timestamp with time zone,
	"message_text" text NOT NULL,
	"outcome" "training_outcome" DEFAULT 'unmapped' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "training_messages" ADD CONSTRAINT "training_messages_batch_id_training_conversation_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."training_conversation_batches"("id") ON DELETE no action ON UPDATE no action;