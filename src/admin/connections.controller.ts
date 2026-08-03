import { Router } from "express";
import { env } from "../config/env.js";
import { requireAdminToken } from "./auth.middleware.js";

export const adminConnectionsRouter = Router();
adminConnectionsRouter.use(requireAdminToken);

function isConfigured(value: string | undefined): boolean {
  return Boolean(value) && value !== "pendiente";
}

adminConnectionsRouter.get("/", (_req, res) => {
  res.json({
    whatsapp: {
      connected:
        isConfigured(env.WHATSAPP_ACCESS_TOKEN) &&
        isConfigured(env.WHATSAPP_PHONE_NUMBER_ID) &&
        isConfigured(env.META_APP_SECRET),
      available: true,
    },
    instagram: {
      connected: isConfigured(env.INSTAGRAM_ACCESS_TOKEN),
      available: true,
    },
    claude: {
      connected: isConfigured(env.ANTHROPIC_API_KEY),
      model: env.CLAUDE_MODEL,
      available: true,
    },
    webhook: {
      connected: isConfigured(env.META_WEBHOOK_VERIFY_TOKEN),
      available: true,
    },
    calendly: { connected: false, available: false },
    facebookMessenger: { connected: false, available: false },
  });
});
