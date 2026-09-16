import { PDFDocument, StandardFonts } from "pdf-lib";

const BASE = process.env.API_URL || "http://localhost:8000";
const email = `tester_${Date.now()}@papermind.test`;
const password = "password123";
const username = `tester_${Date.now()}`;

let failures = 0;

async function req(method: string, path: string, opts: { token?: string; json?: unknown; form?: FormData; raw?: boolean } = {}) {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.json !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: opts.form ? opts.form : opts.json !== undefined ? JSON.stringify(opts.json) : undefined,
  });
  const text = await res.text();
  let data: any = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* keep text */
  }
  return { status: res.status, data };
}

function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    console.log(`  PASS  ${name}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${name}`, extra ?? "");
  }
}

async function makePdf(title: string, body: string) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const lines = [title, "2024", "", "Abstract", body, "", "1 Introduction", body];
  let y = 740;
  for (const line of lines) {
    const wrapped = line.match(/.{1,90}/g) || [""];
    for (const part of wrapped) {
      page.drawText(part, { x: 50, y, size: 11, font });
      y -= 16;
    }
  }
  return Buffer.from(await doc.save());
}

async function main() {
  console.log(`Smoke testing ${BASE}\n`);

  const health = await req("GET", "/api/health");
  check("GET /api/health", health.status === 200 && health.data.status === "ok", health);

  const register = await req("POST", "/api/v1/auth/register", {
    json: { email, username, password },
  });
  check("POST /auth/register", register.status === 201 && register.data.access_token && register.data.user.email === email, register);
  const token: string = register.data.access_token;

  const dup = await req("POST", "/api/v1/auth/register", {
    json: { email, username, password },
  });
  check("POST /auth/register duplicate -> 409", dup.status === 409, dup);

  const badLogin = await req("POST", "/api/v1/auth/login", {
    json: { email, password: "wrong-password" },
  });
  check("POST /auth/login invalid -> 401", badLogin.status === 401, badLogin);

  const login = await req("POST", "/api/v1/auth/login", { json: { email, password } });
  check("POST /auth/login", login.status === 200 && login.data.access_token, login);

  const me = await req("GET", "/api/v1/auth/me", { token });
  check("GET /auth/me", me.status === 200 && me.data.username === username, me);

  const unauth = await req("GET", "/api/v1/auth/me");
  check("GET /auth/me without token -> 401", unauth.status === 401, unauth);

  const emptyPapers = await req("GET", "/api/v1/papers", { token });
  check("GET /papers empty", emptyPapers.status === 200 && emptyPapers.data.total === 0, emptyPapers);

  const dash = await req("GET", "/api/v1/papers/dashboard", { token });
  check("GET /papers/dashboard", dash.status === 200 && dash.data.total_papers === 0, dash);

  const notPdf = new FormData();
  notPdf.append("file", new Blob(["hello"], { type: "text/plain" }), "notes.txt");
  const badUpload = await req("POST", "/api/v1/papers/upload", { token, form: notPdf });
  check("POST /papers/upload non-pdf -> 400", badUpload.status === 400, badUpload);

  const pdf1 = await makePdf(
    "Attention Is All You Need",
    "We propose the Transformer, a model architecture that relies entirely on attention mechanisms. ".repeat(8),
  );
  const pdf2 = await makePdf(
    "BERT Bidirectional Transformers",
    "BERT pre-trains deep bidirectional representations from unlabeled text. ".repeat(8),
  );

  const form1 = new FormData();
  form1.append("file", new Blob([pdf1], { type: "application/pdf" }), "attention.pdf");
  const up1 = await req("POST", "/api/v1/papers/upload", { token, form: form1 });
  check("POST /papers/upload paper 1", up1.status === 201 && up1.data.status === "ready", up1);

  const form2 = new FormData();
  form2.append("file", new Blob([pdf2], { type: "application/pdf" }), "bert.pdf");
  const up2 = await req("POST", "/api/v1/papers/upload", { token, form: form2 });
  check("POST /papers/upload paper 2", up2.status === 201 && up2.data.status === "ready", up2);

  const listed = await req("GET", "/api/v1/papers", { token });
  check("GET /papers after upload", listed.status === 200 && listed.data.total === 2, listed);

  const ask = await req("POST", "/api/v1/rag/ask", {
    token,
    json: { question: "What architecture is proposed?", paper_ids: [up1.data.id], top_k: 3 },
  });
  check("POST /rag/ask", ask.status === 200 && typeof ask.data.answer === "string" && Array.isArray(ask.data.citations), ask);

  const summary = await req("POST", "/api/v1/rag/summarize", { token, json: { paper_id: up1.data.id } });
  check("POST /rag/summarize", summary.status === 200 && summary.data.paper_id === up1.data.id, summary);

  const compare = await req("POST", "/api/v1/rag/compare", {
    token,
    json: { paper_id_1: up1.data.id, paper_id_2: up2.data.id },
  });
  check("POST /rag/compare", compare.status === 200 && compare.data.paper_1_title, compare);

  const search = await req("POST", "/api/v1/rag/search", {
    token,
    json: { query: "attention mechanism transformer", top_k: 5 },
  });
  check("POST /rag/search", search.status === 200 && Array.isArray(search.data.results), search);

  const rec = await req("POST", "/api/v1/rag/recommend", { token, json: { paper_id: up1.data.id, top_k: 3 } });
  check("POST /rag/recommend", rec.status === 200 && Array.isArray(rec.data.recommendations), rec);

  const session = await req("POST", "/api/v1/chat/sessions", {
    token,
    json: { paper_ids: [up1.data.id], title: "Smoke chat" },
  });
  check("POST /chat/sessions", session.status === 201 && session.data.id && Array.isArray(session.data.messages), session);

  const sessions = await req("GET", "/api/v1/chat/sessions", { token });
  check("GET /chat/sessions returns array", sessions.status === 200 && Array.isArray(sessions.data) && sessions.data.length >= 1, sessions);

  const chatAsk = await req("POST", "/api/v1/chat/ask", {
    token,
    json: { session_id: session.data.id, question: "Summarize the main idea." },
  });
  check("POST /chat/ask", chatAsk.status === 200 && typeof chatAsk.data.answer === "string", chatAsk);

  const oneSession = await req("GET", `/api/v1/chat/sessions/${session.data.id}`, { token });
  check("GET /chat/sessions/:id has messages", oneSession.status === 200 && oneSession.data.messages.length >= 2, oneSession);

  const delSession = await req("DELETE", `/api/v1/chat/sessions/${session.data.id}`, { token });
  check("DELETE /chat/sessions/:id", delSession.status === 204, delSession);

  const delPaper = await req("DELETE", `/api/v1/papers/${up2.data.id}`, { token });
  check("DELETE /papers/:id", delPaper.status === 204, delPaper);

  const afterDelete = await req("GET", "/api/v1/papers", { token });
  check("GET /papers after delete", afterDelete.status === 200 && afterDelete.data.total === 1, afterDelete);

  const dash2 = await req("GET", "/api/v1/papers/dashboard", { token });
  check("GET /papers/dashboard after activity", dash2.status === 200 && dash2.data.total_queries > 0, dash2);

  console.log(`\n${failures === 0 ? "All smoke tests passed." : `${failures} smoke test(s) failed.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
