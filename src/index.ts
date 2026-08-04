import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type ErrorRequestHandler } from "express";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { whatsappRouter } from "./webhooks/whatsapp.controller.js";
import { adminConversationRouter } from "./admin/conversation.controller.js";
import { adminSystemPromptRouter } from "./admin/systemPrompt.controller.js";
import { adminConnectionsRouter } from "./admin/connections.controller.js";
import { adminTagRouter } from "./admin/tag.controller.js";
import { startFollowUpScheduler } from "./services/followUp.service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "../public");

const app = express();

app.use(pinoHttp({ logger }));

app.use(express.static(publicDir));

app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as express.Request).rawBody = Buffer.from(buf);
    },
  }),
);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/webhooks/whatsapp", whatsappRouter);
app.use("/admin/conversations", adminConversationRouter);
app.use("/admin/system-prompt", adminSystemPromptRouter);
app.use("/admin/connections", adminConnectionsRouter);
app.use("/admin/tags", adminTagRouter);

const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  req.log?.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
};
app.use(errorHandler);

app.listen(env.PORT, () => {
  logger.info(`Server listening on port ${env.PORT}`);
  startFollowUpScheduler();
});
