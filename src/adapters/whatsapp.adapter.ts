import type { WhatsAppWebhookPayload } from "../types/meta.js";
import type { NormalizedInboundMessage } from "./types.js";

export function parseWhatsAppWebhook(payload: WhatsAppWebhookPayload): NormalizedInboundMessage[] {
  const normalized: NormalizedInboundMessage[] = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value?.messages?.length) continue;

      const contactsByWaId = new Map(
        (value.contacts ?? []).map((c) => [c.wa_id, c.profile?.name]),
      );

      for (const message of value.messages) {
        const isText = message.type === "text";
        normalized.push({
          platform: "whatsapp",
          externalContactId: message.from,
          contactDisplayName: contactsByWaId.get(message.from),
          contactPhoneNumber: message.from,
          platformMessageId: message.id,
          text: isText ? (message.text?.body ?? null) : null,
          isTextMessage: isText,
          rawPayload: message,
        });
      }
    }
  }

  return normalized;
}
