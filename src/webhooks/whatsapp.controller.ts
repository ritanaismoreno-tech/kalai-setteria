import { Router } from "express";
import { env } from "../config/env.js";
import { verifyMetaSignature } from "./signature.middleware.js";
import { parseWhatsAppWebhook } from "../adapters/whatsapp.adapter.js";
import type { WhatsAppWebhookPayload } from "../types/meta.js";
import { processInboundMessage } from "../services/conversation.service.js";
import { logger } from "../lib/logger.js";

export const whatsappRouter = Router();

whatsappRouter.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === env.META_WEBHOOK_VERIFY_TOKEN) {
    res.status(200).send(challenge);
    return;
  }

  res.sendStatus(403);
});

whatsappRouter.post("/", verifyMetaSignature, async (req, res) => {
  // Processed synchronously in-request (see plan: volume is low enough that
  // this is simpler than a queue). Errors are logged, not surfaced via the
  // response code, since Meta retries wouldn't help once dedup has run.
  try {
    const payload = req.body as WhatsAppWebhookPayload;
    const inboundMessages = parseWhatsAppWebhook(payload);

    for (const message of inboundMessages) {
      await processInboundMessage(message);
    }
  } catch (error) {
    logger.error({ error }, "Error processing WhatsApp webhook");
  }

  res.sendStatus(200);
});
