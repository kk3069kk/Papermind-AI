import { extractText, getDocumentProxy, getMeta } from "unpdf";
import { getLogger } from "../logger.js";

const logger = getLogger("pdf-parser");

export interface ParsedPage {
  page_number: number;
  text: string;
  char_count: number;
}

export interface ParsedDocument {
  title: string;
  authors: string | null;
  abstract: string | null;
  year: number | null;
  pages: ParsedPage[];
  full_text: string;
  page_count: number;
  metadata: Record<string, string>;
}

export function extractYear(text: string): number | null {
  const matches = text.slice(0, 2000).match(/\b(19\d{2}|20[0-2]\d)\b/);
  return matches ? Number(matches[1]) : null;
}

export function extractAbstract(text: string): string | null {
  const match = text.match(
    /abstract[.\s]*\n(.*?)(?=\n(?:1\.?\s*introduction|keywords|1\s+introduction))/is,
  );
  if (match?.[1]) return match[1].trim().slice(0, 2000);
  return null;
}

function extractTitleAuthors(
  metaTitle: string | undefined,
  metaAuthor: string | undefined,
  firstPageText: string,
): [string, string | null] {
  const lines = firstPageText.split("\n").map((l) => l.trim()).filter(Boolean);
  let title = (metaTitle || "").trim();
  let author = (metaAuthor || "").trim();

  if (!title) title = lines[0] || "Untitled";
  if (!author) author = lines[1] || "";

  return [title.slice(0, 500), author ? author.slice(0, 500) : null];
}

export async function parsePdf(buffer: Buffer): Promise<ParsedDocument> {
  const data = new Uint8Array(buffer);
  const pdf = await getDocumentProxy(data);
  const meta = await getMeta(pdf);
  const extracted = await extractText(pdf, { mergePages: false });

  const pageTexts = Array.isArray(extracted.text) ? extracted.text : [extracted.text];
  const pages: ParsedPage[] = pageTexts.map((text, i) => {
    const cleaned = text.replace(/\n{3,}/g, "\n\n").trim();
    return { page_number: i + 1, text: cleaned, char_count: cleaned.length };
  });

  const fullText = pages.map((p) => p.text).join("\n\n");
  const firstPageText = pages[0]?.text || "";
  const info = (meta?.info || {}) as Record<string, string>;
  const [title, authors] = extractTitleAuthors(info.Title, info.Author, firstPageText);

  logger.info("pdf_parsed", { pages: pages.length, chars: fullText.length });

  return {
    title,
    authors,
    abstract: extractAbstract(fullText),
    year: extractYear(firstPageText),
    pages,
    full_text: fullText,
    page_count: pages.length,
    metadata: {
      subject: info.Subject || "",
      creator: info.Creator || "",
      keywords: info.Keywords || "",
    },
  };
}
