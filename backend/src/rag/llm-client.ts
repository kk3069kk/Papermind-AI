import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { settings } from "../config.js";
import { getLogger } from "../logger.js";

const logger = getLogger("llm");

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export const QA_SYSTEM =
  "You are PaperMind AI, an expert research assistant. " +
  "Answer questions based ONLY on the provided research paper excerpts. " +
  "Always cite your sources by referencing [Paper: title, Page: N] for each claim. " +
  "If the context doesn't contain sufficient information, say so clearly.";

export const SUMMARY_SYSTEM =
  "You are an expert academic summarizer. " +
  "Provide structured summaries of research papers based on the given text. " +
  "Be concise, accurate, and academic in tone.";

export const COMPARE_SYSTEM =
  "You are an expert research analyst specializing in comparing academic papers. " +
  "Provide detailed, objective comparisons based only on the provided paper excerpts.";

export function buildQaMessages(question: string, contextChunks: Array<Record<string, unknown>>): ChatMessage[] {
  const context = contextChunks
    .map(
      (c, i) =>
        `[Source ${i + 1}: ${c.paper_title}, Page ${c.page_number ?? "N/A"}]\n${c.content}`,
    )
    .join("\n\n");
  return [
    { role: "system", content: QA_SYSTEM },
    { role: "user", content: `Context:\n${context}\n\nQuestion: ${question}` },
  ];
}

export function buildSummaryMessages(paperText: string, title: string): ChatMessage[] {
  return [
    { role: "system", content: SUMMARY_SYSTEM },
    {
      role: "user",
      content:
        `Paper: ${title}\n\nText:\n${paperText.slice(0, 12000)}\n\n` +
        "Provide a structured summary with these sections:\n" +
        "1. SUMMARY (2-3 sentences)\n" +
        "2. KEY_CONTRIBUTIONS (bullet list)\n" +
        "3. METHODOLOGY\n" +
        "4. RESULTS\n" +
        "5. LIMITATIONS",
    },
  ];
}

export function buildCompareMessages(
  paper1Text: string,
  paper1Title: string,
  paper2Text: string,
  paper2Title: string,
): ChatMessage[] {
  return [
    { role: "system", content: COMPARE_SYSTEM },
    {
      role: "user",
      content:
        `Paper 1: ${paper1Title}\n${paper1Text.slice(0, 6000)}\n\n` +
        `Paper 2: ${paper2Title}\n${paper2Text.slice(0, 6000)}\n\n` +
        "Compare across:\n" +
        "1. METHODOLOGY\n2. DATASETS\n3. PERFORMANCE_METRICS\n4. CONCLUSIONS\n5. OVERALL_COMPARISON",
    },
  ];
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (i === attempts - 1) break;
      const wait = Math.min(10, 2 * 2 ** i) * 1000;
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw last;
}

async function callOpenAI(messages: ChatMessage[], model: string, temperature: number, maxTokens: number) {
  const client = new OpenAI({ apiKey: settings.openaiApiKey });
  const resp = await client.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  });
  return {
    text: resp.choices[0]?.message?.content || "",
    tokens: resp.usage?.total_tokens || 0,
  };
}

async function callOpenRouter(messages: ChatMessage[], model: string, temperature: number, maxTokens: number) {
  const client = new OpenAI({
    apiKey: settings.openrouterApiKey,
    baseURL: "https://openrouter.ai/api/v1",
  });
  const resp = await client.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  });
  return {
    text: resp.choices[0]?.message?.content || "",
    tokens: resp.usage?.total_tokens || 0,
  };
}

async function callGemini(messages: ChatMessage[], model: string, temperature: number, maxTokens: number) {
  const client = new GoogleGenAI({ apiKey: settings.geminiApiKey });
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const response = await client.models.generateContent({
    model,
    contents,
    config: {
      temperature,
      maxOutputTokens: maxTokens,
      systemInstruction: system || undefined,
    },
  });

  return {
    text: response.text || "",
    tokens: response.usageMetadata?.totalTokenCount || 0,
  };
}

async function callAnthropic(messages: ChatMessage[], model: string, temperature: number, maxTokens: number) {
  const client = new Anthropic({ apiKey: settings.anthropicApiKey });
  const system = messages.find((m) => m.role === "system")?.content || "";
  const userMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const resp = await client.messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    system,
    messages: userMessages,
  });
  const text = resp.content[0]?.type === "text" ? resp.content[0].text : "";
  return { text, tokens: (resp.usage?.input_tokens || 0) + (resp.usage?.output_tokens || 0) };
}

function mockCompletion(messages: ChatMessage[]): { text: string; tokens: number } {
  const last = messages[messages.length - 1]?.content || "";
  if (last.includes("KEY_CONTRIBUTIONS")) {
    return {
      text:
        "1. SUMMARY: This paper studies the topic described in the provided excerpts.\n" +
        "2. KEY_CONTRIBUTIONS\n- Identifies the main research claim\n- Documents the experimental setup\n" +
        "3. METHODOLOGY: Methods described in the source text.\n" +
        "4. RESULTS: Results reported in the source text.\n" +
        "5. LIMITATIONS: Limited context window in local mock mode.",
      tokens: 40,
    };
  }
  if (last.includes("OVERALL_COMPARISON")) {
    return {
      text:
        "1. METHODOLOGY: Both papers describe their methods in the provided excerpts.\n" +
        "2. DATASETS: Dataset details taken from the excerpts.\n" +
        "3. PERFORMANCE_METRICS: Metrics mentioned in the excerpts.\n" +
        "4. CONCLUSIONS: Conclusions drawn from the excerpts.\n" +
        "5. OVERALL_COMPARISON: The two papers differ in focus based on the supplied text.",
      tokens: 50,
    };
  }
  const snippet = last.slice(0, 400);
  return {
    text: `Based on the provided excerpts: ${snippet.slice(-280)}`,
    tokens: 20,
  };
}

export async function chatCompletion(
  messages: ChatMessage[],
  temperature = 0.2,
  maxTokens = 2048,
): Promise<{ text: string; tokens: number }> {
  if (settings.mockAiEnabled) {
    logger.info("llm_call", { provider: "mock" });
    return mockCompletion(messages);
  }

  const provider = settings.llmProvider;
  logger.info("llm_call", { provider });

  return withRetry(async () => {
    if (provider === "openai") {
      return callOpenAI(messages, settings.openaiModel, temperature, maxTokens);
    }
    if (provider === "openrouter") {
      return callOpenRouter(messages, settings.openrouterModel, temperature, maxTokens);
    }
    if (provider === "gemini") {
      return callGemini(messages, settings.geminiModel, temperature, maxTokens);
    }
    if (provider === "anthropic") {
      return callAnthropic(messages, settings.anthropicModel, temperature, maxTokens);
    }
    throw new Error(`Unknown LLM_PROVIDER: ${provider}`);
  });
}
