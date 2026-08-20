CREATE TYPE "public"."credential_provider" AS ENUM('whatsapp', 'meta', 'anthropic');--> statement-breakpoint
CREATE TABLE "credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "credential_provider" NOT NULL,
	"encrypted_payload" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "credentials_provider_idx" ON "credentials" USING btree ("provider");