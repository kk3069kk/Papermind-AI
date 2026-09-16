import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../errors.js";
import { requireAuth } from "../middleware/auth.js";
import {
  answerQuestion,
  comparePapers,
  recommendRelated,
  semanticSearch,
  summarizePaper,
} from "../services/rag.service.js";

export const ragRouter = Router();
ragRouter.use(requireAuth);

ragRouter.post(
  "/ask",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        question: z.string().min(1),
        paper_ids: z.array(z.number()).optional().nullable(),
        top_k: z.number().int().positive().optional(),
      })
      .parse(req.body);
    res.json(await answerQuestion(body.question, req.user!.id, body.paper_ids, body.top_k ?? 5));
  }),
);

ragRouter.post(
  "/summarize",
  asyncHandler(async (req, res) => {
    const body = z.object({ paper_id: z.number() }).parse(req.body);
    res.json(await summarizePaper(body.paper_id, req.user!.id));
  }),
);

ragRouter.post(
  "/compare",
  asyncHandler(async (req, res) => {
    const body = z.object({ paper_id_1: z.number(), paper_id_2: z.number() }).parse(req.body);
    res.json(await comparePapers(body.paper_id_1, body.paper_id_2, req.user!.id));
  }),
);

ragRouter.post(
  "/search",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        query: z.string().min(1),
        author: z.string().optional(),
        year: z.number().optional(),
        top_k: z.number().int().positive().optional(),
      })
      .parse(req.body);
    res.json(await semanticSearch(body.query, req.user!.id, body.author, body.year, body.top_k ?? 10));
  }),
);

ragRouter.post(
  "/recommend",
  asyncHandler(async (req, res) => {
    const body = z.object({ paper_id: z.number(), top_k: z.number().int().positive().optional() }).parse(req.body);
    res.json(await recommendRelated(body.paper_id, req.user!.id, body.top_k ?? 5));
  }),
);
