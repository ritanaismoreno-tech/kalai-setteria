import type { WhatsAppWebhookPayload } from "../types/meta.js";
import type { NormalizedInboundMessage } from "./types.js";

export function parseWhatsAppWebhook(
  payload: WhatsAppWebhookPayload,
): NormalizedInboundMessage[] {
  const results: NormalizedInboundMessage[] = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const contactsByWaId = new Map(
        (change.value.contacts ?? []).map((c) => [c.wa_id, c.profile.name]),
      );

      for (const message of change.value.messages ?? []) {
        const isTextMessage = message.type === "text";
        results.push({
          platform: "whatsapp",
          externalUserId: message.from,
          platformMessageId: message.id,
          text: isTextMessage ? (message.text?.body ?? null) : null,
          isTextMessage,
          timestamp: new Date(Number(message.timestamp) * 1000),
          senderDisplayName: contactsByWaId.get(message.from) ?? null,
          rawPayload: message,
        });
      }
    }
  }

  return results;
}

export function formatWhatsAppOutboundPayload(to: string, text: string) {
  return {
    messaging_product: "whatsapp" as const,
    to,
    type: "text" as const,
    text: { body: text },
  };
}
