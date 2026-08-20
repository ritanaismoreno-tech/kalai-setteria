import { logger } from "../lib/logger.js";
import { AppError } from "../lib/errors.js";
import { getCredential } from "../services/credentials.service.js";

const GRAPH_API_BASE = "https://graph.facebook.com/v21.0";

export async function sendWhatsAppText(toWaId: string, text: string): Promise<string> {
  const whatsapp = await getCredential("whatsapp");
  if (!whatsapp?.phoneNumberId || !whatsapp?.accessToken) {
    throw new AppError("WhatsApp no está configurado todavía (pestaña Conexiones)", 409);
  }

  const url = `${GRAPH_API_BASE}/${whatsapp.phoneNumberId}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${whatsapp.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: toWaId,
      type: "text",
      text: { body: text },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    logger.error({ status: response.status, body }, "Fallo al enviar mensaje de WhatsApp");
    throw new AppError(`Error enviando mensaje de WhatsApp: ${response.status}`, 502);
  }

  const data = (await response.json()) as { messages?: { id: string }[] };
  return data.messages?.[0]?.id ?? "";
}
