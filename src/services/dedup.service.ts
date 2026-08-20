import { db } from "../db/client.js";
import { processedWebhookEvents } from "../db/schema.js";

/**
 * Intenta registrar un platform_message_id como procesado.
 * Devuelve true si es la primera vez que se ve (hay que procesarlo),
 * false si ya se había procesado (reintento de Meta, cortar aquí).
 */
export async function claimWebhookEvent(
  platformMessageId: string,
  platform: "whatsapp" | "instagram",
): Promise<boolean> {
  try {
    await db.insert(processedWebhookEvents).values({ platformMessageId, platform });
    return true;
  } catch (err: unknown) {
    if (isUniqueViolation(err)) return false;
    throw err;
  }
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "23505";
}
