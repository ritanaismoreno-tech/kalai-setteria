import { db } from "../db/client.js";
import { processedWebhookEvents } from "../db/schema.js";
import type { Platform } from "../adapters/types.js";

/**
 * Records a platform message id as processed. Returns false if it was
 * already recorded (i.e. this is a Meta webhook retry / duplicate delivery),
 * in which case the caller should short-circuit without re-processing.
 */
export async function markProcessedIfNew(
  platform: Platform,
  platformMessageId: string,
): Promise<boolean> {
  try {
    await db.insert(processedWebhookEvents).values({
      platform,
      platformMessageId,
    });
    return true;
  } catch (error) {
    if (isUniqueViolation(error)) {
      return false;
    }
    throw error;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}
