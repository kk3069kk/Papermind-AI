import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { settings } from "../config.js";
import { HttpError } from "../errors.js";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(plain: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}

export function createAccessToken(subject: string, expiresMinutes?: number): string {
  const minutes = expiresMinutes ?? settings.accessTokenExpireMinutes;
  return jwt.sign({ sub: subject }, settings.secretKey, {
    algorithm: settings.algorithm,
    expiresIn: minutes * 60,
  });
}

export function decodeToken(token: string): { sub: string } {
  try {
    const payload = jwt.verify(token, settings.secretKey, {
      algorithms: [settings.algorithm],
    }) as { sub?: string };
    if (!payload.sub) {
      throw new HttpError(401, "Invalid token");
    }
    return { sub: payload.sub };
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(401, "Invalid or expired token");
  }
}
