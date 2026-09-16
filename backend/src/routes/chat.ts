import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../errors.js";
import { requireAuth } from "../middleware/auth.js";
import { ask, createSession, deleteSession, getMessages, getSession, listSessions } from "../services/chat.service.js";
import { serializeChatSession } from "../utils/serialize.js";

export const chatRouter = Router();
chatRouter.use(requireAuth);

chatRouter.post(
  "/sessions",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        paper_ids: z.array(z.number()).optional().nullable(),
        title: z.string().optional(),
      })
      .parse(req.body ?? {});
    const session = await createSession(req.user!.id, body.paper_ids, body.title ?? "New Chat");
    res.status(201).json(serializeChatSession(session, []));
  }),
);

chatRouter.get(
  "/sessions",
  asyncHandler(async (req, res) => {
    const sessions = await listSessions(req.user!.id);
    res.json(sessions.map((s) => serializeChatSession(s, [])));
  }),
);

chatRouter.get(
  "/sessions/:session_id",
  asyncHandler(async (req, res) => {
    const session = await getSession(req.params.session_id, req.user!.id);
    const messages = await getMessages(req.params.session_id, req.user!.id);
    res.json(serializeChatSession(session, messages));
  }),
);

chatRouter.delete(
  "/sessions/:session_id",
  asyncHandler(async (req, res) => {
    await deleteSession(req.params.session_id, req.user!.id);
    res.status(204).send();
  }),
);

chatRouter.post(
  "/ask",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        session_id: z.string(),
        question: z.string().min(1),
        top_k: z.number().int().positive().optional(),
      })
      .parse(req.body);
    res.json(await ask(body.session_id, body.question, req.user!.id, body.top_k ?? 5));
  }),
);
