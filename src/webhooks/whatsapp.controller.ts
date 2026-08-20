import { Router } from "express";
import { logger } from "../lib/logger.js";
import { getCredential } from "../services/credentials.service.js";
import { parseWhatsAppWebhook } from "../adapters/whatsapp.adapter.js";
import { claimWebhookEvent } from "../services/dedup.service.js";
import {
  findOrCreateContact,
  findOrCreateConversation,
  getConversationById,
  getHistory,
  persistMessage,
} from "../services/conversation.service.js";
import { generateReply } from "../services/claude.service.js";
import { sendWhatsAppText } from "../senders/whatsapp.sender.js";
import { verifyMetaSignature } from "./signature.middleware.js";
import type { WhatsAppWebhookPayload } from "../types/meta.js";

export const whatsappWebhookRouter = Router();

whatsappWebhookRouter.get("/webhooks/whatsapp", async (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const meta = await getCredential("meta");

  if (mode === "subscribe" && meta?.webhookVerifyToken && token === meta.webhookVerifyToken) {
    res.status(200).send(challenge);
    return;
  }

  res.sendStatus(403);
});

whatsappWebhookRouter.post("/webhooks/whatsapp", verifyMetaSignature, async (req, res) => {
  // Siempre 200 tras verificar la firma: reintentos de Meta no deben acumularse.
  res.sendStatus(200);

  const payload = req.body as WhatsAppWebhookPayload;
  const inboundMessages = parseWhatsAppWebhook(payload);

  for (const inbound of inboundMessages) {
    try {
      const isNew = await claimWebhookEvent(inbound.platformMessageId, inbound.platform);
      if (!isNew) {
        logger.info({ id: inbound.platformMessageId }, "Webhook duplicado, ignorado");
        continue;
      }

      const contact = await findOrCreateContact({
        platform: inbound.platform,
        externalId: inbound.externalContactId,
        displayName: inbound.contactDisplayName,
        phoneNumber: inbound.contactPhoneNumber,
      });

      const conversation = await findOrCreateConversation(contact.id, inbound.platform);

      await persistMessage({
        conversationId: conversation.id,
        role: "user",
        content: inbound.text ?? "[mensaje no soportado en v1]",
        direction: "inbound",
        platformMessageId: inbound.platformMessageId,
        rawPayload: inbound.rawPayload,
      });

      if (!inbound.isTextMessage) {
        logger.info({ conversationId: conversation.id }, "Mensaje no-texto registrado, no procesado por IA");
        continue;
      }

      const current = await getConversationById(conversation.id);
      if (current.status === "paused") {
        logger.info({ conversationId: conversation.id }, "Conversación pausada, IA no responde");
        continue;
      }

      const history = await getHistory(conversation.id);
      const replyText = await generateReply(history);
      if (!replyText) continue;

      await sendWhatsAppText(inbound.externalContactId, replyText);
      await persistMessage({
        conversationId: conversation.id,
        role: "assistant",
        content: replyText,
        direction: "outbound",
      });
    } catch (err) {
      logger.error({ err, messageId: inbound.platformMessageId }, "Error procesando mensaje de WhatsApp");
    }
  }
});
