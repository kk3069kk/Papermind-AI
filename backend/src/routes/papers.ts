import { Router } from "express";
import multer from "multer";
import { settings } from "../config.js";
import { asyncHandler, HttpError } from "../errors.js";
import { requireAuth } from "../middleware/auth.js";
import {
  deletePaper,
  getDashboardStats,
  getPaper,
  getUserPapers,
  uploadAndProcess,
} from "../services/paper.service.js";
import { serializePaper } from "../utils/serialize.js";

export const papersRouter = Router();
papersRouter.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: settings.maxFileSizeMb * 1024 * 1024 },
});

papersRouter.post(
  "/upload",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, "Only PDF files are accepted");
    const paper = await uploadAndProcess(req.file, req.user!.id);
    res.status(201).json(serializePaper(paper));
  }),
);

papersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const skip = Number(req.query.skip || 0);
    const limit = Math.min(Number(req.query.limit || 50), 100);
    const author = req.query.author ? String(req.query.author) : undefined;
    const year = req.query.year ? Number(req.query.year) : undefined;
    const { papers, total } = await getUserPapers(req.user!.id, skip, limit, author, year);
    res.json({ papers: papers.map(serializePaper), total });
  }),
);

papersRouter.get(
  "/dashboard",
  asyncHandler(async (req, res) => {
    res.json(await getDashboardStats(req.user!.id));
  }),
);

papersRouter.get(
  "/:paper_id",
  asyncHandler(async (req, res) => {
    const paper = await getPaper(Number(req.params.paper_id), req.user!.id);
    res.json(serializePaper(paper));
  }),
);

papersRouter.delete(
  "/:paper_id",
  asyncHandler(async (req, res) => {
    await deletePaper(Number(req.params.paper_id), req.user!.id);
    res.status(204).send();
  }),
);
