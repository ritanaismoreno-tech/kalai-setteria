import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type NextFunction, type Request, type Response } from "express";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { AppError } from "./lib/errors.js";
import { whatsappWebhookRouter } from "./webhooks/whatsapp.controller.js";
import { requireAdminToken } from "./admin/auth.middleware.js";
import { conversationRouter } from "./admin/conversation.controller.js";
import { systemPromptRouter } from "./admin/systemPrompt.controller.js";
import { connectionsRouter } from "./admin/connections.controller.js";
import { tagRouter } from "./admin/tag.controller.js";
import { onboardingRouter } from "./admin/onboarding.controller.js";
import { startFollowUpScheduler } from "./services/followUp.service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(pinoHttp({ logger }));

// El middleware de firma necesita el body crudo, así que se captura aquí.
app.use(
  express.json({
    // Límite alto: el CSV de conversaciones de entrenamiento viaja como texto en el body JSON.
    limit: "15mb",
    verify: (req, _res, buf) => {
      (req as Request & { rawBody?: Buffer }).rawBody = buf;
    },
  }),
);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use(whatsappWebhookRouter);

app.use("/admin", requireAdminToken, conversationRouter);
app.use("/admin", requireAdminToken, systemPromptRouter);
app.use("/admin", requireAdminToken, connectionsRouter);
app.use("/admin", requireAdminToken, tagRouter);
app.use("/admin", requireAdminToken, onboardingRouter);

app.use(express.static(path.join(__dirname, "..", "public")));

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  logger.error({ err }, "Error no manejado");
  res.status(500).json({ error: "Error interno" });
});

app.listen(env.PORT, () => {
  logger.info(`Kalai Setteria escuchando en el puerto ${env.PORT}`);
  startFollowUpScheduler();
});
