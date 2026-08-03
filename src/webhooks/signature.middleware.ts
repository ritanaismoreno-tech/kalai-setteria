import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

declare module "express-serve-static-core" {
  interface Request {
    rawBody?: Buffer;
  }
}

export function verifyMetaSignature(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const signatureHeader = req.header("x-hub-signature-256");

  if (!signatureHeader || !req.rawBody) {
    logger.warn("Missing signature header or raw body on webhook request");
    return res.sendStatus(401);
  }

  const expectedSignature =
    "sha256=" +
    crypto
      .createHmac("sha256", env.META_APP_SECRET)
      .update(req.rawBody)
      .digest("hex");

  const signaturesMatch =
    signatureHeader.length === expectedSignature.length &&
    crypto.timingSafeEqual(
      Buffer.from(signatureHeader),
      Buffer.from(expectedSignature),
    );

  if (!signaturesMatch) {
    logger.warn("Invalid webhook signature");
    return res.sendStatus(401);
  }

  next();
}
