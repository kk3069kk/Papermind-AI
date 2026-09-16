import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../errors.js";
import { requireAuth } from "../middleware/auth.js";
import { authenticate, createUser } from "../services/user.service.js";
import { createAccessToken } from "../utils/security.js";
import { serializeUser } from "../utils/serialize.js";

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(1),
  password: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const data = registerSchema.parse(req.body);
    const user = await createUser(data);
    res.status(201).json({
      access_token: createAccessToken(String(user.id)),
      token_type: "bearer",
      user: serializeUser(user),
    });
  }),
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const data = loginSchema.parse(req.body);
    const user = await authenticate(data.email, data.password);
    res.json({
      access_token: createAccessToken(String(user.id)),
      token_type: "bearer",
      user: serializeUser(user),
    });
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(serializeUser(req.user!));
  }),
);
