export interface NormalizedInboundMessage {
  platform: "whatsapp" | "instagram";
  externalContactId: string;
  contactDisplayName?: string;
  contactPhoneNumber?: string;
  platformMessageId: string;
  text: string | null;
  isTextMessage: boolean;
  rawPayload: unknown;
}

export interface NormalizedOutboundMessage {
  platform: "whatsapp" | "instagram";
  toExternalId: string;
  text: string;
}
