import type { Prisma } from "@prisma/client";
import { settings } from "../config.js";
import { prisma } from "../db.js";
import { HttpError } from "../errors.js";
import { getLogger } from "../logger.js";
import { chunkDocument } from "../rag/chunker.js";
import { embedTexts } from "../rag/embedder.js";
import { parsePdf } from "../rag/pdf-parser.js";
import { getFaissStore } from "../rag/vector-store.js";
import { deletePdf, uploadPdf } from "../utils/cloudinary.js";

const logger = getLogger("paper-service");

function safeFilename(name: string) {
  return name.replace(/[^\w\-_. ]/g, "_");
}

export async function uploadAndProcess(file: Express.Multer.File, userId: number) {
  if (!file.originalname?.toLowerCase().endsWith(".pdf")) {
    throw new HttpError(400, "Only PDF files are accepted");
  }
  if (file.size > settings.maxFileSizeMb * 1024 * 1024) {
    throw new HttpError(413, `File exceeds ${settings.maxFileSizeMb}MB limit`);
  }

  const safeName = safeFilename(file.originalname);
  const cloud = await uploadPdf(file.buffer, safeName, userId);

  const paper = await prisma.paper.create({
    data: {
      userId,
      title: safeName,
      filename: safeName,
      filePath: cloud.url,
      fileSize: file.size,
      status: "processing",
      paperMetadata: { cloudinary_public_id: cloud.public_id },
    },
  });

  try {
    await processPaper(paper.id, file.buffer);
  } catch (e) {
    logger.error("paper_processing_failed", { paper_id: paper.id, error: String(e) });
    await prisma.paper.update({ where: { id: paper.id }, data: { status: "error" } });
  }

  return prisma.paper.findUniqueOrThrow({ where: { id: paper.id } });
}

async function processPaper(paperId: number, pdfBytes: Buffer) {
  const parsed = await parsePdf(pdfBytes);
  const existing = await prisma.paper.findUniqueOrThrow({ where: { id: paperId } });
  const existingMeta = (existing.paperMetadata as Record<string, unknown>) || {};

  await prisma.paper.update({
    where: { id: paperId },
    data: {
      title: parsed.title,
      authors: parsed.authors,
      abstract: parsed.abstract,
      year: parsed.year,
      pageCount: parsed.page_count,
      paperMetadata: { ...existingMeta, ...parsed.metadata } as Prisma.InputJsonValue,
    },
  });

  const chunks = chunkDocument(parsed);
  const texts = chunks.map((c) => c.content);
  const embeddings = await embedTexts(texts);
  const store = getFaissStore();
  const faissIds = await store.addVectors(
    embeddings,
    chunks.map((c) => ({ paper_id: paperId, chunk_index: c.chunk_index })),
  );

  await prisma.paperChunk.createMany({
    data: chunks.map((chunk, i) => ({
      paperId,
      chunkIndex: chunk.chunk_index,
      content: chunk.content,
      pageNumber: chunk.page_number,
      faissVectorId: faissIds[i],
      tokenCount: chunk.token_count,
    })),
  });

  await prisma.paper.update({
    where: { id: paperId },
    data: { chunkCount: chunks.length, status: "ready" },
  });
  logger.info("paper_processed", { paper_id: paperId, chunks: chunks.length });
}

export async function getUserPapers(
  userId: number,
  skip = 0,
  limit = 50,
  author?: string,
  year?: number,
) {
  const where: Prisma.PaperWhereInput = { userId };
  if (author) where.authors = { contains: author, mode: "insensitive" };
  if (year) where.year = year;

  const [total, papers] = await Promise.all([
    prisma.paper.count({ where }),
    prisma.paper.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
  ]);
  return { papers, total };
}

export async function getPaper(paperId: number, userId: number) {
  const paper = await prisma.paper.findFirst({ where: { id: paperId, userId } });
  if (!paper) throw new HttpError(404, "Paper not found");
  return paper;
}

export async function deletePaper(paperId: number, userId: number) {
  const paper = await getPaper(paperId, userId);
  const meta = (paper.paperMetadata as Record<string, string> | null) || {};
  await deletePdf(meta.cloudinary_public_id || "", paper.filePath);
  await getFaissStore().deleteByPaper(paperId);
  await prisma.paper.delete({ where: { id: paperId } });
}

export async function getDashboardStats(userId: number) {
  const [totalPapers, chunkAgg, totalQueries, recent, statusRows] = await Promise.all([
    prisma.paper.count({ where: { userId } }),
    prisma.paper.aggregate({ where: { userId }, _sum: { chunkCount: true } }),
    prisma.queryHistory.count({ where: { userId } }),
    prisma.queryHistory.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.paper.groupBy({
      by: ["status"],
      where: { userId },
      _count: { status: true },
    }),
  ]);

  return {
    total_papers: totalPapers,
    total_chunks: chunkAgg._sum.chunkCount || 0,
    total_queries: totalQueries,
    recent_queries: recent.map((q) => ({
      id: q.id,
      query: q.query,
      type: q.queryType,
      created_at: q.createdAt.toISOString(),
    })),
    papers_by_status: Object.fromEntries(statusRows.map((r) => [r.status, r._count.status])),
  };
}
