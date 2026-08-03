export type Platform = "whatsapp" | "instagram";

export interface NormalizedInboundMessage {
  platform: Platform;
  externalUserId: string;
  platformMessageId: string;
  text: string | null;
  isTextMessage: boolean;
  timestamp: Date;
  senderDisplayName: string | null;
  rawPayload: unknown;
}

export interface NormalizedOutboundMessage {
  platform: Platform;
  externalUserId: string;
  text: string;
}

export interface OutboundSendResult {
  platformMessageId: string;
}
