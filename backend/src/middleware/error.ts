import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { HttpError } from "../errors.js";
import { getLogger } from "../logger.js";

const logger = getLogger("error");

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ detail: err.message });
  }
  if (err instanceof ZodError) {
    const first = err.errors[0];
    return res.status(400).json({ detail: first?.message || "Invalid request" });
  }
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ detail: "File exceeds upload size limit" });
    }
    return res.status(400).json({ detail: err.message });
  }
  logger.error("unhandled_error", { error: err instanceof Error ? err.message : String(err) });
  return res.status(500).json({ detail: "Internal server error" });
}
