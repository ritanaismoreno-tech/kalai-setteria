import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";

export function requireAdminToken(req: Request, res: Response, next: NextFunction): void {
  const header = req.header("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

  if (!token || token !== env.ADMIN_BEARER_TOKEN) {
    res.status(401).json({ error: "No autorizado" });
    return;
  }

  next();
}
