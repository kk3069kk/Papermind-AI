import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chunkDocument, chunkText, estimateTokens } from "../src/rag/chunker.js";
import { extractAbstract, extractYear } from "../src/rag/pdf-parser.js";
import { parseSummaryResponse } from "../src/rag/parse-sections.js";

describe("chunker", () => {
  it("estimates tokens as length/4", () => {
    assert.equal(estimateTokens("abcd"), 1);
    assert.equal(estimateTokens("abcdefgh"), 2);
  });

  it("splits on sentence boundaries and keeps page numbers", () => {
    const sentence = "This is a reasonably long research sentence about transformers. ";
    const text = sentence.repeat(80);
    const chunks = chunkText(text, 40, 8, 0, 3);
    assert.ok(chunks.length > 1);
    assert.equal(chunks[0].page_number, 3);
    assert.equal(chunks[0].chunk_index, 0);
    assert.ok(chunks.every((c) => c.content.length > 0));
  });

  it("skips short pages when chunking a document", () => {
    const chunks = chunkDocument({
      title: "T",
      authors: null,
      abstract: null,
      year: 2024,
      full_text: "",
      page_count: 2,
      metadata: {},
      pages: [
        { page_number: 1, text: "too short", char_count: 9 },
        {
          page_number: 2,
          text: "Abstract\nAttention is all you need. This paper introduces the transformer architecture for sequence transduction. Introduction follows after this abstract block.",
          char_count: 160,
        },
      ],
    });
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].page_number, 2);
  });
});

describe("pdf metadata helpers", () => {
  it("extracts year and abstract", () => {
    const text =
      "Attention Is All You Need 2017\n\nAbstract\nWe propose the Transformer.\n\n1 Introduction\nMore text.";
    assert.equal(extractYear(text), 2017);
    assert.match(extractAbstract(text) || "", /Transformer/);
  });
});

describe("summary parser", () => {
  it("parses structured LLM sections", () => {
    const parsed = parseSummaryResponse(
      { id: 1, title: "Paper" },
      [
        "1. SUMMARY: A short overview.",
        "2. KEY_CONTRIBUTIONS",
        "- First contribution",
        "- Second contribution",
        "3. METHODOLOGY: Used transformers.",
        "4. RESULTS: Strong gains.",
        "5. LIMITATIONS: Small dataset.",
      ].join("\n"),
    );
    assert.match(parsed.summary, /overview/);
    assert.ok(parsed.key_contributions.some((c) => c.includes("First")));
    assert.match(parsed.methodology, /transformers/);
    assert.match(parsed.results, /gains/);
    assert.match(parsed.limitations, /dataset/);
  });
});
