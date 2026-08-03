import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  META_APP_SECRET: z.string().min(1, "META_APP_SECRET is required"),
  META_WEBHOOK_VERIFY_TOKEN: z
    .string()
    .min(1, "META_WEBHOOK_VERIFY_TOKEN is required"),

  WHATSAPP_ACCESS_TOKEN: z.string().min(1, "WHATSAPP_ACCESS_TOKEN is required"),
  WHATSAPP_PHONE_NUMBER_ID: z
    .string()
    .min(1, "WHATSAPP_PHONE_NUMBER_ID is required"),

  INSTAGRAM_ACCESS_TOKEN: z.string().optional(),
  INSTAGRAM_PAGE_ID: z.string().optional(),

  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),
  CLAUDE_MODEL: z.string().default("claude-sonnet-5"),

  ADMIN_BEARER_TOKEN: z.string().min(1, "ADMIN_BEARER_TOKEN is required"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration");
}

export const env = parsed.data;
