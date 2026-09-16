# PaperMind AI — Comprehensive Architecture & Tech Stack Guide

---

## 📖 1. What PaperMind AI Does

**PaperMind AI** is an intelligent **AI-powered Research Assistant & Document Intelligence Platform**. It enables researchers, academics, students, and engineers to upload complex research papers (PDFs) and interact with them using a **Citation-Aware Retrieval-Augmented Generation (RAG)** pipeline.

### Key Capabilities

1. **Intelligent PDF Ingestion & Parsing**:
   - Upload multiple PDF documents with automatic extraction of title, authors, abstract, publication year, page counts, and full-text content.
   - Text is split into structured, page-mapped semantic chunks.

2. **Citation-Aware RAG Q&A**:
   - Ask complex research questions across one or more papers.
   - Generates answers grounded directly in the paper text, returning **exact source citations** including paper title and page numbers.

3. **Structured Paper Summarization**:
   - Automatically decomposes dense research papers into standardized research components:
     - **Core Contributions**
     - **Methodology & Architecture**
     - **Key Results & Benchmarks**
     - **Limitations & Future Directions**

4. **Multi-Paper Comparison**:
   - Compare two research papers side-by-side across methodology, datasets, evaluation metrics, advantages, and trade-offs.

5. **Semantic & Filtered Search**:
   - Search your library using natural language embeddings with optional metadata filters (author, publication year, etc.).

6. **Related Paper Recommendations**:
   - Suggests conceptually related papers from your library based on vector cosine similarity.

7. **Interactive Multi-Turn Chat Sessions**:
   - Persistent conversation threads linked to specific papers with full message history and citation tracking.

8. **Multi-User Security & Dashboard**:
   - JWT-based authentication, user isolation, and personal research metrics (paper count, chunk count, query history).

---

## 🏗️ 2. High-Level System Architecture

```mermaid
flowchart TD
    subgraph Client["Frontend (React 18 + Vite + TailwindCSS)"]
        UI[User Interface & Pages]
        State[Zustand Store & React Query]
        API_Client[Axios HTTP Client + JWT]
    end

    subgraph Server["Backend (Node.js + Express + TypeScript)"]
        Router[Express Routers: Auth, Papers, RAG, Chat]
        AuthSec[Security: JWT + bcryptjs]
        PDFEng[PDF Parser & Sentence Chunker]
        RAGCore[RAG Pipeline & Prompt Engine]
        LLMHub[Multi-Provider LLM Client]
    end

    subgraph Storage["Databases & Vector Storage"]
        PG[(PostgreSQL 16 via Prisma ORM)]
        FAISS[(FAISS Vector IndexFlatIP)]
        Disk[(Local Storage / Cloudinary)]
    end

    subgraph AI_Providers["AI & Embeddings Providers"]
        Gemini[Google Gemini: embedding-001 / 1.5-flash]
        OpenAI[OpenAI: gpt-4o-mini]
        Anthropic[Anthropic Claude: 3.5-Haiku]
        OpenRouter[OpenRouter: Llama 3.1 / Mistral]
        Mock[Local Mock AI Engine]
    end

    UI --> State --> API_Client
    API_Client <-->|REST API / JSON| Router
    Router --> AuthSec
    Router --> PDFEng
    Router --> RAGCore
    PDFEng --> Disk
    PDFEng --> PG
    RAGCore <--> FAISS
    RAGCore <--> PG
    RAGCore --> LLMHub
    LLMHub --> AI_Providers
```

---

## 💻 3. Technology Stack Breakdown

| Layer | Technologies Used | Description & Purpose |
|---|---|---|
| **Frontend Framework** | **React 18** | Component-driven declarative UI library |
| **Build Tool & Bundler** | **Vite 5** | Lightning-fast ESM dev server and optimized production build tool |
| **Language** | **TypeScript 5** | Static typing across both frontend and backend for end-to-end reliability |
| **Styling & Design** | **Tailwind CSS 3 + PostCSS** | Utility-first responsive styling with dark/light mode support |
| **UI Component Primitives** | **Radix UI** | Accessible, unstyled UI primitives (`@radix-ui/react-label`, `@radix-ui/react-slot`, `@radix-ui/react-separator`) |
| **Icons** | **Lucide React** | Modern, consistent SVG icon set |
| **Client State Management** | **Zustand** | Lightweight, reactive global store for authentication and active session state |
| **Data Fetching & Cache** | **TanStack Query v5 (React Query)** | Async server state synchronization, query caching, and optimistic mutations |
| **HTTP Client** | **Axios** | Promise-based HTTP client with automatic Bearer token interceptors |
| **Routing** | **React Router DOM v6** | Declarative client-side routing with protected route middleware |
| **File Uploads (UI)** | **React Dropzone** | Drag-and-drop PDF file upload component with MIME-type validation |
| **Markdown Rendering** | **React Markdown + Remark GFM** | Renders AI responses, equations, tables, and structured markdown |
| **Toast Notifications** | **Sonner** | Modern toast notification manager |
| **Backend Runtime** | **Node.js 22 (ES Modules)** | Non-blocking, event-driven JavaScript server runtime |
| **Web Framework** | **Express.js 4** | Minimalist RESTful API framework and middleware handler |
| **Runtime Execution** | **tsx** | Zero-config TypeScript execution engine with file watcher |
| **Validation** | **Zod** | TypeScript-first runtime schema validation for API requests |
| **Database** | **PostgreSQL 16** | Robust relational database for structured paper metadata, chunks, users, and history |
| **Database ORM** | **Prisma 6** | Modern type-safe ORM for database schema modeling, migrations, and typed queries |
| **Vector Search Engine** | **FAISS (IndexFlatIP)** | Facebook AI Similarity Search using Inner Product (cosine similarity on normalized vectors) |
| **PDF Extraction** | **unpdf (PDF.js) + pdf-lib** | Pure JavaScript / Node.js PDF parsing, page text extraction, and metadata inspection |
| **Authentication & Crypto** | **JSON Web Tokens (JWT) + bcryptjs** | Stateless token auth (`jsonwebtoken`) and cross-platform password hashing (`bcryptjs`) |
| **Multi-Part Uploads** | **Multer** | Multipart/form-data handler for streaming PDF uploads |
| **AI Embeddings** | **Google Gemini (`gemini-embedding-001`)** | 3072-dimensional normalized embeddings for semantic vector indexing |
| **LLM Inference** | **OpenAI, OpenRouter, Gemini, Anthropic, Mock** | Unified multi-provider LLM client with zero-key fallback mock support |
| **Cloud File Storage (Optional)** | **Cloudinary** | Cloud storage for uploaded PDF files (falls back to local filesystem `./uploads`) |
| **Containerization** | **Docker & Docker Compose** | Containerized PostgreSQL service with persistent storage volumes and healthchecks |
| **Deployment Configuration** | **Render (`render.yaml`)** | Infrastructure-as-code for deploying backend, frontend, and PostgreSQL on Render |

---

## 🔍 4. Deep-Dive: Core Components & Modules

### 4.1. Prisma & PostgreSQL Layer

**Prisma** serves as the Single Source of Truth for the database layer (`backend/prisma/schema.prisma`):

```mermaid
erDiagram
    User ||--o{ Paper : "owns"
    User ||--o{ QueryHistory : "runs"
    User ||--o{ ChatSession : "creates"
    Paper ||--o{ PaperChunk : "contains"
    ChatSession ||--o{ ChatMessage : "contains"

    User {
        int id PK
        string email UK
        string username UK
        string hashedPassword
        boolean isActive
        datetime createdAt
        datetime updatedAt
    }

    Paper {
        int id PK
        int userId FK
        string title
        string authors
        string abstract
        int year
        string filename
        string filePath
        int fileSize
        int pageCount
        int chunkCount
        string faissIndexId
        string status
        string summary
        json paperMetadata
        datetime createdAt
        datetime updatedAt
    }

    PaperChunk {
        int id PK
        int paperId FK
        int chunkIndex
        string content
        int pageNumber
        int faissVectorId
        int tokenCount
        datetime createdAt
    }

    QueryHistory {
        int id PK
        int userId FK
        string query
        string answer
        string queryType
        json paperIds
        json citations
        int tokensUsed
        datetime createdAt
    }

    ChatSession {
        string id PK
        int userId FK
        string title
        json paperIds
        datetime createdAt
        datetime updatedAt
    }

    ChatMessage {
        int id PK
        string sessionId FK
        string role
        string content
        json citations
        int tokensUsed
        datetime createdAt
    }
```

- **Why Prisma?**
  - Provides end-to-end type safety: changing `schema.prisma` automatically updates generated TypeScript types for every query.
  - `npx prisma db push` synchronizes schema definitions to PostgreSQL instantly during development.
  - Handles cascade deletions automatically (e.g. deleting a paper deletes all associated chunks).

---

### 4.2. Docker & Containerization

The project uses Docker Compose (`docker-compose.yml`) to orchestrate the infrastructure:
- **Service**: `postgres:16`
- **Port Mapping**: `5432:5432`
- **Volume**: `papermind_pg` for persistent data storage across restarts.
- **Healthcheck**: Uses `pg_isready -U papermind -d papermind` to ensure the database is ready before backend connections.

---

### 4.3. The Citation-Aware RAG Pipeline

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Frontend
    participant Backend
    participant Embedder as Gemini Embedder
    participant FAISS as FAISS Vector Store
    participant PG as PostgreSQL (Prisma)
    participant LLM as LLM Provider

    User->>Frontend: Enter question: "What dataset was used?"
    Frontend->>Backend: POST /api/v1/rag/ask { query, paper_ids }
    Backend->>Embedder: Generate Query Embedding (RETRIEVAL_QUERY)
    Embedder-->>Backend: 3072-d Normalized Vector
    Backend->>FAISS: Search Top-K Nearest Neighbors (filtered by paper_id)
    FAISS-->>Backend: [vector_id, score]
    Backend->>PG: Query PaperChunks by faissVectorId
    PG-->>Backend: Chunk Text + Page Numbers + Paper Metadata
    Backend->>LLM: Formulate Citation-Aware Prompt + Injected Chunks
    LLM-->>Backend: Answer with [Source: "Paper Title", p. X]
    Backend-->>Frontend: { answer, citations: [ { paper_id, title, page_number } ] }
    Frontend-->>User: Render formatted answer with clickable citation badges
```

1. **Chunking (`chunker.ts`)**:
   - Parses PDF text page-by-page.
   - Splits text into ~512 token chunks on sentence boundaries with 64-token overlap to maintain semantic continuity.
   - Preserves exact page numbers (`pageNumber`) on every chunk.

2. **Vector Indexing (`vector-store.ts`)**:
   - Uses FAISS `IndexFlatIP` (Inner Product). Because vectors are L2-normalized upon creation, inner product directly calculates **Cosine Similarity**.
   - Supports metadata filtering so searches can be scoped to specific paper IDs.
   - Automatically writes index to disk (`./faiss_index`) and can rebuild itself from PostgreSQL if needed (`index-rebuild.ts`).

3. **Multi-Provider LLM Client (`llm-client.ts`)**:
   - Configurable via `LLM_PROVIDER` in `.env`:
     - `openai`: OpenAI GPT-4o-mini
     - `openrouter`: OpenRouter models (Llama 3.1, etc.)
     - `gemini`: Google Gemini 1.5 Flash
     - `anthropic`: Anthropic Claude 3.5 Haiku
     - **Mock AI Mode**: Runs automatically when no API keys are provided in development, allowing full offline testing of the entire application.

---

## 📡 5. Complete API Reference

Base URL: `http://localhost:8000/api/v1`

### 5.1. Authentication Routes (`/auth`)

| Method | Endpoint | Description | Auth Required | Request Body / Params |
|---|---|---|---|---|
| `POST` | `/auth/register` | Register a new user | No | `{ "email", "username", "password" }` |
| `POST` | `/auth/login` | Login and receive JWT access token | No | Form data or JSON `{ "email", "password" }` |
| `GET` | `/auth/me` | Get current authenticated user profile | Yes (Bearer JWT) | Headers: `Authorization: Bearer <token>` |

### 5.2. Paper Management Routes (`/papers`)

| Method | Endpoint | Description | Auth Required | Request Body / Params |
|---|---|---|---|---|
| `POST` | `/papers/upload` | Upload a PDF research paper | Yes | `multipart/form-data` with `file: <pdf_file>` |
| `GET` | `/papers` | List user's papers (with filters) | Yes | Query params: `?author=...&year=...` |
| `GET` | `/papers/:id` | Get single paper details | Yes | URL param: `:id` |
| `DELETE` | `/papers/:id` | Delete paper and its vector embeddings | Yes | URL param: `:id` |
| `GET` | `/papers/dashboard` | Get summary metrics & statistics | Yes | None |

### 5.3. RAG & Intelligence Routes (`/rag`)

| Method | Endpoint | Description | Auth Required | Request Body / Params |
|---|---|---|---|---|
| `POST` | `/rag/ask` | Ask a question across papers with citations | Yes | `{ "query": string, "paper_ids"?: number[] }` |
| `POST` | `/rag/summarize` | Generate structured summary of a paper | Yes | `{ "paper_id": number }` |
| `POST` | `/rag/compare` | Compare two papers side-by-side | Yes | `{ "paper_id_a": number, "paper_id_b": number }` |
| `POST` | `/rag/search` | Natural language semantic search | Yes | `{ "query": string, "limit"?: number }` |
| `POST` | `/rag/recommend` | Find related papers in library | Yes | `{ "paper_id": number, "limit"?: number }` |

### 5.4. Chat Session Routes (`/chat`)

| Method | Endpoint | Description | Auth Required | Request Body / Params |
|---|---|---|---|---|
| `POST` | `/chat/sessions` | Create a new interactive chat session | Yes | `{ "title"?: string, "paper_ids"?: number[] }` |
| `GET` | `/chat/sessions` | List user's chat sessions | Yes | None |
| `GET` | `/chat/sessions/:id` | Get chat session with full message history | Yes | URL param: `:id` |
| `DELETE` | `/chat/sessions/:id` | Delete a chat session | Yes | URL param: `:id` |
| `POST` | `/chat/ask` | Send message in chat session and get AI reply | Yes | `{ "session_id": string, "message": string }` |

### 5.5. Health & Diagnostic Routes

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/health` | Service healthcheck, version, and app name | No |

---

## ⚙️ 6. Environment Variables Reference

### Backend (`backend/.env`)

```env
# Server Configuration
DEBUG=true
PORT=8000
NODE_ENV=development
SECRET_KEY=local-dev-secret-key-not-for-production
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Database Configuration
DATABASE_URL=postgresql://papermind:papermind@localhost:5432/papermind

# LLM Provider Selection (openai | openrouter | gemini | anthropic)
LLM_PROVIDER=openai

# Provider API Keys (optional in dev mode - fallback to mock)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# Google Gemini (Embeddings & LLM)
# GEMINI_API_KEY=AIza...
# GEMINI_MODEL=gemini-1.5-flash

# RAG & Vector Search Tuning
EMBEDDING_MODEL=gemini-embedding-001
EMBEDDING_DIM=3072
CHUNK_SIZE=512
CHUNK_OVERLAP=64
TOP_K_RETRIEVAL=5
FAISS_INDEX_PATH=./faiss_index
MAX_FILE_SIZE_MB=50
```

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:8000
```

---

## 🚀 7. Running the Project Locally

```bash
# 1. Start PostgreSQL with Docker
cd Papermind-AI
docker compose up -d

# 2. Setup & Start Backend
cd backend
npm install
npx prisma db push
npm run dev

# 3. Setup & Start Frontend (in a new terminal)
cd frontend
npm install
npm run dev
```

- **Frontend App**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:8000](http://localhost:8000)
- **API Health**: [http://localhost:8000/api/health](http://localhost:8000/api/health)
