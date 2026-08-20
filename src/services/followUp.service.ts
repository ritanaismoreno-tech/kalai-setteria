import { and, eq, isNotNull, lt } from "drizzle-orm";
import { db } from "../db/client.js";
import { contacts, conversations } from "../db/schema.js";
import { logger } from "../lib/logger.js";
import { sendWhatsAppText } from "../senders/whatsapp.sender.js";
import { persistMessage } from "./conversation.service.js";

// Ver docs/plan.md y docs/system-prompt-brief.md (sección 10): mientras el
// follow-up se envíe antes de que expiren las 24h desde el último mensaje del
// lead, sigue siendo un mensaje de sesión normal (sin plantilla, sin costo).
const FOLLOW_UP_DELAY_HOURS = 17;
const WINDOW_HOURS = 24;
const MAX_FOLLOW_UPS = 1;
const CHECK_INTERVAL_MS = 15 * 60 * 1000;

const FALLBACK_FOLLOW_UP_TEXT =
  "Hola de nuevo 🙂 Quería asegurarme de que viste mi mensaje anterior. " +
  "¿Sigues por aquí? Cuéntame si tienes alguna duda.";

export function startFollowUpScheduler(): void {
  runCheck().catch((err) => logger.error({ err }, "Error en el chequeo de follow-ups"));
  setInterval(() => {
    runCheck().catch((err) => logger.error({ err }, "Error en el chequeo de follow-ups"));
  }, CHECK_INTERVAL_MS);
}

async function runCheck(): Promise<void> {
  const now = Date.now();
  const delayThreshold = new Date(now - FOLLOW_UP_DELAY_HOURS * 60 * 60 * 1000);
  const windowThreshold = new Date(now - WINDOW_HOURS * 60 * 60 * 1000);

  const candidates = await db
    .select({
      id: conversations.id,
      followUpsSent: conversations.followUpsSent,
      externalId: contacts.externalId,
    })
    .from(conversations)
    .innerJoin(contacts, eq(conversations.contactId, contacts.id))
    .where(
      and(
        eq(conversations.status, "active"),
        eq(conversations.platform, "whatsapp"),
        isNotNull(conversations.lastInboundAt),
        lt(conversations.lastInboundAt, delayThreshold),
      ),
    );

  for (const candidate of candidates) {
    if (candidate.followUpsSent >= MAX_FOLLOW_UPS) continue;

    // No mandar si ya se salió de la ventana de 24h (se deja perder el seguimiento, no se abre plantilla).
    const [fresh] = await db.select().from(conversations).where(eq(conversations.id, candidate.id));
    if (!fresh?.lastInboundAt || fresh.lastInboundAt < windowThreshold) continue;
    if (fresh.status !== "active" || fresh.followUpsSent >= MAX_FOLLOW_UPS) continue;

    try {
      await sendWhatsAppText(candidate.externalId, FALLBACK_FOLLOW_UP_TEXT);
      await persistMessage({
        conversationId: candidate.id,
        role: "assistant",
        content: FALLBACK_FOLLOW_UP_TEXT,
        direction: "outbound",
      });
      await db
        .update(conversations)
        .set({ followUpsSent: fresh.followUpsSent + 1 })
        .where(eq(conversations.id, candidate.id));
      logger.info({ conversationId: candidate.id }, "Follow-up enviado");
    } catch (err) {
      logger.error({ err, conversationId: candidate.id }, "Fallo al enviar follow-up");
    }
  }
}
