import "dotenv/config";
import { z } from "zod";

// Solo infraestructura aquí. Las credenciales de Meta/WhatsApp/Anthropic son
// self-serve: cada cliente las carga desde la pestaña Conexiones de su propia
// web y quedan cifradas en base_de_datos (ver src/lib/crypto.ts), no en env vars.
const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL es obligatorio"),
  ADMIN_BEARER_TOKEN: z.string().min(1, "ADMIN_BEARER_TOKEN es obligatorio"),
  CREDENTIALS_ENCRYPTION_KEY: z
    .string()
    .min(1, "CREDENTIALS_ENCRYPTION_KEY es obligatorio")
    .refine((v) => Buffer.from(v, "base64").length === 32, {
      message: "CREDENTIALS_ENCRYPTION_KEY debe decodificar a 32 bytes en base64 (genera uno con: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\")",
    }),
  CLAUDE_MODEL: z.string().default("claude-sonnet-5"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Faltan variables de entorno obligatorias:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
