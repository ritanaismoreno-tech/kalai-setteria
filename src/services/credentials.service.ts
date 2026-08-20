import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { env } from "../config/env.js";
import { db } from "../db/client.js";
import { credentials } from "../db/schema.js";
import { encrypt, decrypt } from "../lib/crypto.js";
import { AppError } from "../lib/errors.js";

export type CredentialProvider = "whatsapp" | "meta" | "anthropic";

export interface WhatsAppCredentials {
  phoneNumberId?: string;
  accessToken?: string;
  wabaId?: string;
}

export interface MetaCredentials {
  appSecret?: string;
  webhookVerifyToken?: string;
}

export interface AnthropicCredentials {
  apiKey?: string;
  model?: string;
}

type CredentialShape<P extends CredentialProvider> = P extends "whatsapp"
  ? WhatsAppCredentials
  : P extends "meta"
    ? MetaCredentials
    : AnthropicCredentials;

const REQUIRED_FIELDS: Record<CredentialProvider, string[]> = {
  whatsapp: ["phoneNumberId", "accessToken"],
  meta: ["appSecret", "webhookVerifyToken"],
  anthropic: ["apiKey"],
};

export async function getCredential<P extends CredentialProvider>(
  provider: P,
): Promise<CredentialShape<P> | null> {
  const [row] = await db.select().from(credentials).where(eq(credentials.provider, provider));
  if (!row) return null;
  return JSON.parse(decrypt(row.encryptedPayload)) as CredentialShape<P>;
}

// Merge parcial: los campos que llegan vacíos/omitidos conservan el valor ya
// guardado, para que el cliente pueda actualizar un solo campo sin repegar el resto.
export async function saveCredential<P extends CredentialProvider>(
  provider: P,
  partial: Partial<CredentialShape<P>>,
): Promise<CredentialShape<P>> {
  const current = (await getCredential(provider)) ?? ({} as CredentialShape<P>);
  const merged = { ...current } as Record<string, unknown>;

  for (const [key, value] of Object.entries(partial)) {
    if (typeof value === "string" && value.trim() === "") continue;
    if (value === undefined) continue;
    merged[key] = value;
  }

  const encryptedPayload = encrypt(JSON.stringify(merged));

  const [existing] = await db.select().from(credentials).where(eq(credentials.provider, provider));
  if (existing) {
    await db
      .update(credentials)
      .set({ encryptedPayload, updatedAt: new Date() })
      .where(eq(credentials.provider, provider));
  } else {
    await db.insert(credentials).values({ provider, encryptedPayload });
  }

  return merged as unknown as CredentialShape<P>;
}

export async function isConfigured(provider: CredentialProvider): Promise<boolean> {
  const data = await getCredential(provider);
  if (!data) return false;
  return REQUIRED_FIELDS[provider].every((field) => Boolean((data as Record<string, unknown>)[field]));
}

// El SDK de Anthropic no soporta rotar la key en un cliente ya creado, así que
// se instancia por llamada con la key vigente en base de datos (self-serve).
export async function getAnthropicClient(): Promise<{ client: Anthropic; model: string }> {
  const anthropic = await getCredential("anthropic");
  if (!anthropic?.apiKey) {
    throw new AppError("Anthropic no está configurado todavía (pestaña Conexiones)", 409);
  }

  return {
    client: new Anthropic({ apiKey: anthropic.apiKey }),
    model: anthropic.model?.trim() || env.CLAUDE_MODEL,
  };
}
