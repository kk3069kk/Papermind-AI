import cors from "cors";
import express from "express";
import { settings } from "./config.js";
import { prisma } from "./db.js";
import { errorHandler } from "./middleware/error.js";
import { getLogger } from "./logger.js";
import { rebuildFaissFromDb } from "./rag/index-rebuild.js";
import { getFaissStore } from "./rag/vector-store.js";
import { authRouter } from "./routes/auth.js";
import { chatRouter } from "./routes/chat.js";
import { papersRouter } from "./routes/papers.js";
import { ragRouter } from "./routes/rag.js";

const logger = getLogger("main");
const app = express();

app.use(
  cors({
    origin: settings.allowedOrigins,
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", version: settings.version, app: settings.appName });
});

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/papers", papersRouter);
app.use("/api/v1/rag", ragRouter);
app.use("/api/v1/chat", chatRouter);

app.use(errorHandler);

async function start() {
  logger.info("papermind_starting", {
    version: settings.version,
    provider: settings.llmProvider,
    mock_ai: settings.mockAiEnabled,
  });
  await prisma.$connect();
  getFaissStore();
  await rebuildFaissFromDb();
  logger.info("faiss_ready", { vectors: getFaissStore().totalVectors });

  const server = app.listen(settings.port, "0.0.0.0", () => {
    logger.info("papermind_listening", { port: settings.port });
  });

  const shutdown = async () => {
    logger.info("papermind_shutting_down");
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch((err) => {
  logger.error("startup_failed", { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});

export { app };
