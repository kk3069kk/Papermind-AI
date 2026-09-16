import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

export type LlmProvider = "openai" | "openrouter" | "gemini" | "anthropic";

function env(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function envBool(name: string, fallback = false): boolean {
  const raw = process.env[name];
  if (!raw) return fallback;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

function normalizeDatabaseUrl(url: string): string {
  return url
    .replace("postgresql+asyncpg://", "postgresql://")
    .replace("postgresql+psycopg2://", "postgresql://");
}

const rawProvider = env("LLM_PROVIDER", "openai") as LlmProvider;
const llmProvider: LlmProvider = ["openai", "openrouter", "gemini", "anthropic"].includes(rawProvider)
  ? rawProvider
  : "openai";

export const settings = {
  appName: env("APP_NAME", "PaperMind AI"),
  debug: envBool("DEBUG", false),
  version: env("VERSION", "1.0.0"),
  port: envInt("PORT", 8000),
  nodeEnv: env("NODE_ENV", "development"),

  secretKey: env("SECRET_KEY", "change-me-in-production-use-secrets-module"),
  algorithm: "HS256" as const,
  accessTokenExpireMinutes: envInt("ACCESS_TOKEN_EXPIRE_MINUTES", 60 * 24),

  databaseUrl: normalizeDatabaseUrl(
    env("DATABASE_URL", "postgresql://papermind:papermind@localhost:5432/papermind"),
  ),

  llmProvider,
  openaiApiKey: env("OPENAI_API_KEY") || undefined,
  openaiModel: env("OPENAI_MODEL", "gpt-4o-mini"),
  openrouterApiKey: env("OPENROUTER_API_KEY") || undefined,
  openrouterModel: env("OPENROUTER_MODEL", "meta-llama/llama-3.1-8b-instruct"),
  geminiApiKey: env("GEMINI_API_KEY") || undefined,
  geminiModel: env("GEMINI_MODEL", "gemini-1.5-flash"),
  anthropicApiKey: env("ANTHROPIC_API_KEY") || undefined,
  anthropicModel: env("ANTHROPIC_MODEL", "claude-3-5-haiku-20241022"),

  embeddingModel: env("EMBEDDING_MODEL", "gemini-embedding-001"),
  embeddingDim: envInt("EMBEDDING_DIM", 3072),

  chunkSize: envInt("CHUNK_SIZE", 512),
  chunkOverlap: envInt("CHUNK_OVERLAP", 64),
  topKRetrieval: envInt("TOP_K_RETRIEVAL", 5),
  faissIndexPath: env("FAISS_INDEX_PATH", "./faiss_index"),

  maxFileSizeMb: envInt("MAX_FILE_SIZE_MB", 50),

  cloudinaryCloudName: env("CLOUDINARY_CLOUD_NAME"),
  cloudinaryApiKey: env("CLOUDINARY_API_KEY"),
  cloudinaryApiSecret: env("CLOUDINARY_API_SECRET"),

  allowedOrigins: env("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3001")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),

  get isProduction() {
    return this.nodeEnv === "production";
  },

  get cloudinaryEnabled() {
    return Boolean(this.cloudinaryCloudName && this.cloudinaryApiKey && this.cloudinaryApiSecret);
  },

  get mockAiEnabled() {
    return !this.isProduction && !this.geminiApiKey;
  },
};

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = settings.databaseUrl;
}
