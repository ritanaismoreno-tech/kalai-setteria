// Raw WhatsApp Cloud API webhook payload shapes (subset we care about).
// Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples

export interface WhatsAppWebhookPayload {
  object: string;
  entry: WhatsAppEntry[];
}

export interface WhatsAppEntry {
  id: string;
  changes: WhatsAppChange[];
}

export interface WhatsAppChange {
  field: string;
  value: {
    messaging_product: "whatsapp";
    metadata: { display_phone_number: string; phone_number_id: string };
    contacts?: { profile: { name: string }; wa_id: string }[];
    messages?: WhatsAppInboundMessage[];
    statuses?: unknown[];
  };
}

export interface WhatsAppInboundMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
}

// Raw Instagram Messaging API webhook payload shapes (subset), for Phase B.
// Reference: https://developers.facebook.com/docs/messenger-platform/instagram/features/webhook

export interface InstagramWebhookPayload {
  object: string;
  entry: InstagramEntry[];
}

export interface InstagramEntry {
  id: string;
  time: number;
  messaging: InstagramMessagingEvent[];
}

export interface InstagramMessagingEvent {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: { mid: string; text?: string };
}
