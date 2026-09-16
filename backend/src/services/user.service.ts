import { prisma } from "../db.js";
import { HttpError } from "../errors.js";
import { hashPassword, verifyPassword } from "../utils/security.js";

export async function createUser(data: { email: string; username: string; password: string }) {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: data.email }, { username: data.username }] },
  });
  if (existing) {
    throw new HttpError(409, "Email or username already registered");
  }
  return prisma.user.create({
    data: {
      email: data.email,
      username: data.username,
      hashedPassword: await hashPassword(data.password),
    },
  });
}

export async function authenticate(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.hashedPassword))) {
    throw new HttpError(401, "Invalid credentials");
  }
  if (!user.isActive) {
    throw new HttpError(403, "Account disabled");
  }
  return user;
}
