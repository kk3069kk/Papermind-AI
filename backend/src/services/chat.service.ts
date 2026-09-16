import { randomUUID } from "node:crypto";
import type { ChatMessage } from "@prisma/client";
import { prisma } from "../db.js";
import { HttpError } from "../errors.js";
import { embedQuery } from "../rag/embedder.js";
import { chatCompletion, type ChatMessage as LlmMessage } from "../rag/llm-client.js";
import { getFaissStore } from "../rag/vector-store.js";
import type { CitationSource } from "./rag.service.js";

const HISTORY_WINDOW = 6;

export async function createSession(userId: number, paperIds?: number[] | null, title = "New Chat") {
  return prisma.chatSession.create({
    data: {
      id: randomUUID(),
      userId,
      title,
      paperIds: paperIds ?? undefined,
    },
  });
}

export async function getSession(sessionId: string, userId: number) {
  const session = await prisma.chatSession.findFirst({ where: { id: sessionId, userId } });
  if (!session) throw new HttpError(404, "Chat session not found");
  return session;
}

export async function listSessions(userId: number) {
  return prisma.chatSession.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getMessages(sessionId: string, userId: number) {
  await getSession(sessionId, userId);
  return prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
  });
}

export async function deleteSession(sessionId: string, userId: number) {
  await getSession(sessionId, userId);
  await prisma.chatSession.delete({ where: { id: sessionId } });
}

function buildChatMessages(
  question: string,
  contextChunks: Array<Record<string, unknown>>,
  history: ChatMessage[],
): LlmMessage[] {
  const system =
    "You are PaperMind AI, an expert research assistant. " +
    "Answer questions based ONLY on the provided research paper excerpts. " +
    "Do NOT include inline citations like [Paper: ...] or [Source ...] in your response — citations are shown separately. " +
    "Write clean, well-structured answers using markdown (headings, bullet points, bold) where appropriate. " +
    "You have access to the conversation history — use it to give coherent, context-aware answers. " +
    "If the context doesn't have enough information, say so clearly.";

  const contextBlock = contextChunks
    .map(
      (c, i) =>
        `[Source ${i + 1}: ${c.paper_title}, Page ${c.page_number ?? "N/A"}]\n${c.content}`,
    )
    .join("\n\n");

  const messages: LlmMessage[] = [{ role: "system", content: system }];
  for (const msg of history) {
    messages.push({ role: msg.role as "user" | "assistant", content: msg.content });
  }
  messages.push({
    role: "user",
    content: contextBlock ? `Context from papers:\n${contextBlock}\n\nQuestion: ${question}` : question,
  });
  return messages;
}

export async function ask(sessionId: string, question: string, userId: number, topK = 5) {
  const session = await getSession(sessionId, userId);
  const store = getFaissStore();
  const paperIds = (session.paperIds as number[] | null) || undefined;
  const hits = await store.search(await embedQuery(question), topK, paperIds);

  const contextChunks: Array<Record<string, unknown>> = [];
  const citations: CitationSource[] = [];

  if (hits.length) {
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
  }

  const past = await prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    take: HISTORY_WINDOW,
  });
  const pastMessages = past.reverse();
  const { text: answer, tokens } = await chatCompletion(buildChatMessages(question, contextChunks, pastMessages));

  await prisma.chatMessage.createMany({
    data: [
      { sessionId, role: "user", content: question },
      { sessionId, role: "assistant", content: answer, citations: citations as object[], tokensUsed: tokens },
    ],
  });

  if (!pastMessages.length) {
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: { title: question.slice(0, 120) },
    });
  } else {
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });
  }

  return { answer, citations, tokens_used: tokens };
}
