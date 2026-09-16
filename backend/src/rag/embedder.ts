import { GoogleGenAI } from "@google/genai";
import { settings } from "../config.js";
import { getLogger } from "../logger.js";

const logger = getLogger("embedder");

function normalizeRows(matrix: number[][]): number[][] {
  return matrix.map((row) => {
    const norm = Math.sqrt(row.reduce((s, v) => s + v * v, 0));
    const denom = Math.max(norm, 1e-9);
    return row.map((v) => v / denom);
  });
}

function mockEmbed(text: string, dim: number): number[] {
  const vec = new Array(dim).fill(0);
  for (let i = 0; i < text.length; i++) {
    vec[i % dim] += text.charCodeAt(i) / 255;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  const denom = Math.max(norm, 1e-9);
  return vec.map((v) => v / denom);
}

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!client) {
    if (!settings.geminiApiKey) {
      throw new Error("GEMINI_API_KEY is required for embeddings");
    }
    client = new GoogleGenAI({ apiKey: settings.geminiApiKey });
    logger.info("embedding_ready", { model: settings.embeddingModel });
  }
  return client;
}

export async function embedTexts(texts: string[], batchSize = 32): Promise<number[][]> {
  if (settings.mockAiEnabled) {
    return texts.map((t) => mockEmbed(t, settings.embeddingDim));
  }

  const ai = getClient();
  const all: number[][] = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const response = await ai.models.embedContent({
      model: settings.embeddingModel,
      contents: batch,
      config: { taskType: "RETRIEVAL_DOCUMENT", outputDimensionality: settings.embeddingDim },
    });
    for (const emb of response.embeddings || []) {
      all.push(emb.values || []);
    }
  }
  return normalizeRows(all);
}

export async function embedQuery(query: string): Promise<number[]> {
  if (settings.mockAiEnabled) {
    return mockEmbed(query, settings.embeddingDim);
  }

  const ai = getClient();
  const response = await ai.models.embedContent({
    model: settings.embeddingModel,
    contents: query,
    config: { taskType: "RETRIEVAL_QUERY", outputDimensionality: settings.embeddingDim },
  });
  const values = response.embeddings?.[0]?.values || [];
  return normalizeRows([values])[0];
}
