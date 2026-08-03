import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";

export function requireAdminToken(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

  if (!token) {
    return res.sendStatus(401);
  }

  const expected = Buffer.from(env.ADMIN_BEARER_TOKEN);
  const provided = Buffer.from(token);

  const isValid =
    expected.length === provided.length &&
    crypto.timingSafeEqual(expected, provided);

  if (!isValid) {
    return res.sendStatus(401);
  }

  next();
}
