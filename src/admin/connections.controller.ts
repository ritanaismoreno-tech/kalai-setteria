import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { AppError } from "../lib/errors.js";
import {
  getCredential,
  saveCredential,
  isConfigured,
  type CredentialProvider,
} from "../services/credentials.service.js";

export const connectionsRouter = Router();

const PROVIDER_META: Record<CredentialProvider, { name: string; fields: { key: string; label: string; secret: boolean }[] }> = {
  whatsapp: {
    name: "WhatsApp Cloud API",
    fields: [
      { key: "phoneNumberId", label: "Phone Number ID", secret: false },
      { key: "accessToken", label: "Access Token", secret: true },
      { key: "wabaId", label: "WABA ID (opcional)", secret: false },
    ],
  },
  meta: {
    name: "Meta App",
    fields: [
      { key: "appSecret", label: "App Secret", secret: true },
      {
        key: "webhookVerifyToken",
        label: "Webhook Verify Token (lo eliges tú y lo pegas también en la configuración del webhook en Meta)",
        secret: false,
      },
    ],
  },
  anthropic: {
    name: "Anthropic (Claude)",
    fields: [
      { key: "apiKey", label: "API Key", secret: true },
      { key: "model", label: `Modelo (opcional, por defecto ${env.CLAUDE_MODEL})`, secret: false },
    ],
  },
};

function mask(value: string): string {
  if (value.length <= 6) return "•".repeat(value.length);
  return `${value.slice(0, 4)}${"•".repeat(6)}${value.slice(-2)}`;
}

connectionsRouter.get("/connections", async (_req, res) => {
  const providers = Object.keys(PROVIDER_META) as CredentialProvider[];

  const connections = await Promise.all(
    providers.map(async (provider) => {
      const meta = PROVIDER_META[provider];
      const data = ((await getCredential(provider)) ?? {}) as Record<string, string | undefined>;
      const configured = await isConfigured(provider);

      return {
        provider,
        name: meta.name,
        configured,
        fields: meta.fields.map((f) => ({
          key: f.key,
          label: f.label,
          secret: f.secret,
          hasValue: Boolean(data[f.key]),
          value: data[f.key] ? (f.secret ? mask(data[f.key]!) : data[f.key]) : "",
        })),
      };
    }),
  );

  connections.push({
    provider: "instagram" as CredentialProvider,
    name: "Instagram Messaging API",
    configured: false,
    fields: [],
    note: "Fase B — no construido todavía",
  } as (typeof connections)[number] & { note: string });

  res.json({ connections });
});

const saveSchema = z.record(z.string(), z.string());

connectionsRouter.put("/connections/:provider", async (req, res) => {
  const provider = req.params.provider as CredentialProvider;
  if (!(provider in PROVIDER_META)) {
    throw new AppError(`Conexión desconocida: ${provider}`, 400);
  }

  const parsed = saveSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError("Cuerpo inválido", 400);

  const allowedKeys = new Set(PROVIDER_META[provider].fields.map((f) => f.key));
  const filtered = Object.fromEntries(Object.entries(parsed.data).filter(([key]) => allowedKeys.has(key)));

  await saveCredential(provider, filtered);
  res.json({ configured: await isConfigured(provider) });
});
