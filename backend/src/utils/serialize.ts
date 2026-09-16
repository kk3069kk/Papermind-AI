import type { ChatMessage, ChatSession, Paper, User } from "@prisma/client";

export function serializeUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    is_active: user.isActive,
    created_at: user.createdAt.toISOString(),
  };
}

export function serializePaper(paper: Paper) {
  return {
    id: paper.id,
    title: paper.title,
    authors: paper.authors,
    abstract: paper.abstract,
    year: paper.year,
    filename: paper.filename,
    file_size: paper.fileSize,
    page_count: paper.pageCount,
    chunk_count: paper.chunkCount,
    status: paper.status,
    summary: paper.summary,
    created_at: paper.createdAt.toISOString(),
  };
}

export function serializeChatMessage(message: ChatMessage) {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    citations: message.citations ?? null,
    tokens_used: message.tokensUsed,
    created_at: message.createdAt.toISOString(),
  };
}

export function serializeChatSession(session: ChatSession, messages: ChatMessage[] = []) {
  return {
    id: session.id,
    title: session.title,
    paper_ids: session.paperIds ?? null,
    created_at: session.createdAt.toISOString(),
    updated_at: session.updatedAt.toISOString(),
    messages: messages.map(serializeChatMessage),
  };
}

export function serializeCitation(c: {
  paper_id: number;
  paper_title: string;
  chunk_index: number;
  page_number: number | null;
  content: string;
  relevance_score: number;
}) {
  return c;
}
