import { prisma } from "../db.js";
import { getLogger } from "../logger.js";
import { embedTexts } from "./embedder.js";
import { getFaissStore } from "./vector-store.js";

const logger = getLogger("index-rebuild");

export async function rebuildFaissFromDb() {
  const store = getFaissStore();
  if (store.totalVectors > 0) {
    logger.info("faiss_skip_rebuild", { reason: "index_already_populated", vectors: store.totalVectors });
    return;
  }

  const chunks = await prisma.paperChunk.findMany({ orderBy: { faissVectorId: "asc" } });
  if (!chunks.length) {
    logger.info("faiss_skip_rebuild", { reason: "no_chunks_in_db" });
    return;
  }

  logger.info("faiss_rebuilding", { chunk_count: chunks.length });
  const embeddings = await embedTexts(chunks.map((c) => c.content));
  await store.replaceAll(
    embeddings,
    chunks.map((c) => ({ paper_id: c.paperId, chunk_db_id: c.id, chunk_index: c.chunkIndex })),
  );

  const drifted = chunks.filter((chunk, newId) => chunk.faissVectorId !== newId);
  if (drifted.length) {
    await prisma.$transaction(
      drifted.map((chunk, i) => {
        const newId = chunks.findIndex((c) => c.id === chunk.id);
        return prisma.paperChunk.update({ where: { id: chunk.id }, data: { faissVectorId: newId } });
      }),
    );
  }

  logger.info("faiss_rebuilt", { vectors: store.totalVectors });
}
