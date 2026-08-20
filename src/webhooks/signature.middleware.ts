import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { logger } from "../lib/logger.js";
import { getCredential } from "../services/credentials.service.js";

export interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

export async function verifyMetaSignature(req: Request, res: Response, next: NextFunction): Promise<void> {
  const signatureHeader = req.header("X-Hub-Signature-256");
  const rawBody = (req as RequestWithRawBody).rawBody;

  if (!signatureHeader || !rawBody) {
    res.status(401).json({ error: "Falta firma de la solicitud" });
    return;
  }

  const meta = await getCredential("meta");
  if (!meta?.appSecret) {
    logger.warn("Webhook recibido pero Meta no está configurado todavía (pestaña Conexiones)");
    res.status(401).json({ error: "Meta no está configurado todavía" });
    return;
  }

  const expected = "sha256=" + crypto.createHmac("sha256", meta.appSecret).update(rawBody).digest("hex");

  const expectedBuf = Buffer.from(expected);
  const receivedBuf = Buffer.from(signatureHeader);

  const isValid =
    expectedBuf.length === receivedBuf.length && crypto.timingSafeEqual(expectedBuf, receivedBuf);

  if (!isValid) {
    logger.warn("Firma de webhook inválida");
    res.status(401).json({ error: "Firma inválida" });
    return;
  }

  next();
}
