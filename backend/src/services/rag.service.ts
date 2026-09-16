import { prisma } from "../db.js";
import { HttpError } from "../errors.js";
import { getLogger } from "../logger.js";
import { embedQuery, embedTexts } from "../rag/embedder.js";
import {
  buildCompareMessages,
  buildQaMessages,
  buildSummaryMessages,
  chatCompletion,
} from "../rag/llm-client.js";
import { extractSection, parseSummaryResponse } from "../rag/parse-sections.js";
import { averageEmbedding, getFaissStore } from "../rag/vector-store.js";

export { parseSummaryResponse };

const logger = getLogger("rag-service");

export interface CitationSource {
  paper_id: number;
  paper_title: string;
  chunk_index: number;
  page_number: number | null;
  content: string;
  relevance_score: number;
}

async function getOwnedPaper(paperId: number, userId: number) {
  const paper = await prisma.paper.findFirst({ where: { id: paperId, userId } });
  if (!paper) throw new HttpError(404, "Paper not found");
  return paper;
}

export async function answerQuestion(
  question: string,
  userId: number,
  paperIds?: number[] | null,
  topK = 5,
) {
  const store = getFaissStore();
  const qVec = await embedQuery(question);
  const hits = await store.search(qVec, topK, paperIds);

  if (!hits.length) {
    return { answer: "No relevant content found in the selected papers.", citations: [], tokens_used: 0 };
  }

  const chunks = await prisma.paperChunk.findMany({
    where: {
      OR: hits.map((h) =>
        h.chunk_index != null
          ? { paperId: h.paper_id, chunkIndex: h.chunk_index }
          : { faissVectorId: h.faiss_id },
      ),
    },
  });

  const papers = await prisma.paper.findMany({
    where: { id: { in: [...new Set(chunks.map((c) => c.paperId))] }, userId },
  });
  const paperMap = Object.fromEntries(papers.map((p) => [p.id, p]));
  const chunkByKey = new Map(chunks.map((c) => [`${c.paperId}:${c.chunkIndex}`, c]));
  const chunkByFaiss = new Map(chunks.map((c) => [c.faissVectorId, c]));

  const contextChunks: Array<Record<string, unknown>> = [];
  const citations: CitationSource[] = [];

  for (const hit of hits) {
    const chunk =
      (hit.chunk_index != null ? chunkByKey.get(`${hit.paper_id}:${hit.chunk_index}`) : undefined) ||
      chunkByFaiss.get(hit.faiss_id);
    if (!chunk) continue;
    const paper = paperMap[chunk.paperId];
    if (!paper) continue;
    contextChunks.push({
      paper_title: paper.title,
      content: chunk.content,
      page_number: chunk.pageNumber,
    });
    citations.push({
      paper_id: paper.id,
      paper_title: paper.title,
      chunk_index: chunk.chunkIndex,
      page_number: chunk.pageNumber,
      content: chunk.content.slice(0, 300),
      relevance_score: hit.score,
    });
  }

  const { text: answer, tokens } = await chatCompletion(buildQaMessages(question, contextChunks));

  await prisma.queryHistory.create({
    data: {
      userId,
      query: question,
      answer,
      queryType: "qa",
      paperIds: paperIds ?? undefined,
      citations: citations as object[],
      tokensUsed: tokens,
    },
  });

  return { answer, citations, tokens_used: tokens };
}

export async function summarizePaper(paperId: number, userId: number) {
  const paper = await getOwnedPaper(paperId, userId);
  if (paper.summary) return parseSummaryResponse(paper, paper.summary);

  const chunks = await prisma.paperChunk.findMany({
    where: { paperId },
    orderBy: { chunkIndex: "asc" },
    take: 40,
  });
  const fullText = chunks.map((c) => c.content).join("\n\n");
  const { text: summaryText, tokens } = await chatCompletion(buildSummaryMessages(fullText, paper.title), 0.2, 1500);

  await prisma.paper.update({ where: { id: paper.id }, data: { summary: summaryText } });
  await prisma.queryHistory.create({
    data: {
      userId,
      query: `Summarize: ${paper.title}`,
      answer: summaryText,
      queryType: "summary",
      paperIds: [paperId],
      tokensUsed: tokens,
    },
  });

  return parseSummaryResponse(paper, summaryText);
}

export async function comparePapers(paperId1: number, paperId2: number, userId: number) {
  const paper1 = await getOwnedPaper(paperId1, userId);
  const paper2 = await getOwnedPaper(paperId2, userId);

  const getText = async (pid: number) => {
    const rows = await prisma.paperChunk.findMany({
      where: { paperId: pid },
      orderBy: { chunkIndex: "asc" },
      take: 30,
    });
    return rows.map((c) => c.content).join("\n\n");
  };

  const [text1, text2] = await Promise.all([getText(paperId1), getText(paperId2)]);
  const { text: comparisonText, tokens } = await chatCompletion(
    buildCompareMessages(text1, paper1.title, text2, paper2.title),
    0.2,
    2000,
  );

  await prisma.queryHistory.create({
    data: {
      userId,
      query: `Compare: ${paper1.title} vs ${paper2.title}`,
      answer: comparisonText,
      queryType: "compare",
      paperIds: [paperId1, paperId2],
      tokensUsed: tokens,
    },
  });

  return {
    paper_1_title: paper1.title,
    paper_2_title: paper2.title,
    methodology: extractSection(comparisonText, "METHODOLOGY"),
    datasets: extractSection(comparisonText, "DATASETS"),
    performance: extractSection(comparisonText, "PERFORMANCE_METRICS"),
    conclusions: extractSection(comparisonText, "CONCLUSIONS"),
    overall_comparison: extractSection(comparisonText, "OVERALL_COMPARISON") || comparisonText.slice(0, 1000),
  };
}

export async function semanticSearch(
  query: string,
  userId: number,
  author?: string,
  year?: number,
  topK = 10,
) {
  const store = getFaissStore();
  const hits = await store.search(await embedQuery(query), topK * 3);
  if (!hits.length) return { results: [], total: 0 };

  const chunks = await prisma.paperChunk.findMany({
    where: {
      OR: hits.map((h) =>
        h.chunk_index != null
          ? { paperId: h.paper_id, chunkIndex: h.chunk_index }
          : { faissVectorId: h.faiss_id },
      ),
    },
  });
  const chunkByKey = new Map(chunks.map((c) => [`${c.paperId}:${c.chunkIndex}`, c]));
  const chunkByFaiss = new Map(chunks.map((c) => [c.faissVectorId, c]));

  const papers = await prisma.paper.findMany({
    where: {
      userId,
      ...(author ? { authors: { contains: author, mode: "insensitive" } } : {}),
      ...(year ? { year } : {}),
    },
  });
  const paperMap = Object.fromEntries(papers.map((p) => [p.id, p]));

  const results = [];
  for (const hit of hits) {
    const chunk =
      (hit.chunk_index != null ? chunkByKey.get(`${hit.paper_id}:${hit.chunk_index}`) : undefined) ||
      chunkByFaiss.get(hit.faiss_id);
    if (!chunk || !paperMap[chunk.paperId]) continue;
    const paper = paperMap[chunk.paperId];
    results.push({
      paper_id: paper.id,
      paper_title: paper.title,
      authors: paper.authors,
      year: paper.year,
      chunk_content: chunk.content.slice(0, 500),
      page_number: chunk.pageNumber,
      relevance_score: hit.score,
    });
    if (results.length >= topK) break;
  }

  await prisma.queryHistory.create({
    data: { userId, query, queryType: "search", tokensUsed: 0 },
  });

  logger.info("semantic_search", { hits: results.length });
  return { results, total: results.length };
}

export async function recommendRelated(paperId: number, userId: number, topK = 5) {
  await getOwnedPaper(paperId, userId);
  const sourceChunks = await prisma.paperChunk.findMany({ where: { paperId }, take: 5 });
  if (!sourceChunks.length) return { recommendations: [] };

  const embeddings = await embedTexts(sourceChunks.map((c) => c.content));
  const hits = await getFaissStore().search(averageEmbedding(embeddings), topK * 5);

  const seen = new Set<number>([paperId]);
  const recommendations = [];
  for (const hit of hits) {
    const pid = hit.paper_id;
    if (seen.has(pid)) continue;
    seen.add(pid);
    const paper = await prisma.paper.findFirst({ where: { id: pid, userId } });
    if (!paper) continue;
    recommendations.push({
      paper_id: paper.id,
      title: paper.title,
      authors: paper.authors,
      year: paper.year,
      similarity_score: Number(hit.score.toFixed(4)),
    });
    if (recommendations.length >= topK) break;
  }
  return { recommendations };
}
