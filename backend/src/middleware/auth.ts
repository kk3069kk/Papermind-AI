import type { NextFunction, Request, Response } from "express";
import { prisma } from "../db.js";
import { HttpError } from "../errors.js";
import { decodeToken } from "../utils/security.js";

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new HttpError(401, "Not authenticated");
    }
    const payload = decodeToken(header.slice(7));
    const user = await prisma.user.findUnique({ where: { id: Number(payload.sub) } });
    if (!user) throw new HttpError(401, "User not found");
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}
