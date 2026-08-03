import { env } from "../config/env.js";
import { formatWhatsAppOutboundPayload } from "../adapters/whatsapp.adapter.js";
import type { OutboundSendResult } from "../adapters/types.js";
import { logger } from "../lib/logger.js";

const GRAPH_API_VERSION = "v21.0";

export async function sendWhatsAppMessage(
  to: string,
  text: string,
): Promise<OutboundSendResult> {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(formatWhatsAppOutboundPayload(to, text)),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error({ status: response.status, errorBody }, "WhatsApp send failed");
    throw new Error(`WhatsApp send failed: ${response.status} ${errorBody}`);
  }

  const data = (await response.json()) as {
    messages?: { id: string }[];
  };

  const platformMessageId = data.messages?.[0]?.id;
  if (!platformMessageId) {
    throw new Error("WhatsApp send response missing message id");
  }

  return { platformMessageId };
}
