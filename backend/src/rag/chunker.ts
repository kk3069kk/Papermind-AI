import { settings } from "../config.js";
import { getLogger } from "../logger.js";
import type { ParsedDocument } from "./pdf-parser.js";

const logger = getLogger("chunker");

export interface TextChunk {
  content: string;
  chunk_index: number;
  page_number: number | null;
  token_count: number;
}

export function estimateTokens(text: string): number {
  return Math.floor(text.length / 4);
}

export function chunkText(
  text: string,
  chunkSize = settings.chunkSize,
  overlap = settings.chunkOverlap,
  startIndex = 0,
  pageNumber: number | null = null,
): TextChunk[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: TextChunk[] = [];
  let currentTokens = 0;
  let currentSentences: string[] = [];
  let chunkIdx = startIndex;

  for (const sentence of sentences) {
    const sTokens = estimateTokens(sentence);
    if (currentTokens + sTokens > chunkSize && currentSentences.length) {
      chunks.push({
        content: currentSentences.join(" ").trim(),
        chunk_index: chunkIdx,
        page_number: pageNumber,
        token_count: currentTokens,
      });
      chunkIdx += 1;
      const overlapSentences: string[] = [];
      let overlapTokens = 0;
      for (let i = currentSentences.length - 1; i >= 0; i--) {
        const st = estimateTokens(currentSentences[i]);
        if (overlapTokens + st <= overlap) {
          overlapSentences.unshift(currentSentences[i]);
          overlapTokens += st;
        } else {
          break;
        }
      }
      currentSentences = [...overlapSentences, sentence];
      currentTokens = overlapTokens + sTokens;
    } else {
      currentSentences.push(sentence);
      currentTokens += sTokens;
    }
  }

  if (currentSentences.length) {
    chunks.push({
      content: currentSentences.join(" ").trim(),
      chunk_index: chunkIdx,
      page_number: pageNumber,
      token_count: currentTokens,
    });
  }

  return chunks;
}

export function chunkDocument(doc: ParsedDocument): TextChunk[] {
  const allChunks: TextChunk[] = [];
  let idx = 0;
  for (const page of doc.pages) {
    if (page.text.trim().length < 50) continue;
    const pageChunks = chunkText(page.text, settings.chunkSize, settings.chunkOverlap, idx, page.page_number);
    allChunks.push(...pageChunks);
    idx += pageChunks.length;
  }
  logger.info("document_chunked", { chunks: allChunks.length });
  return allChunks;
}
