import fs from "node:fs";
import path from "node:path";
import { settings } from "../config.js";
import { getLogger } from "../logger.js";

const logger = getLogger("vector-store");

export interface VectorMeta {
  paper_id: number;
  chunk_index?: number;
  chunk_db_id?: number;
}

export interface SearchHit extends VectorMeta {
  faiss_id: number;
  score: number;
}

function mean(vectors: number[][]): number[] {
  const dim = vectors[0].length;
  const out = new Array(dim).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) out[i] += v[i];
  }
  for (let i = 0; i < dim; i++) out[i] /= vectors.length;
  const norm = Math.sqrt(out.reduce((s, x) => s + x * x, 0));
  const denom = Math.max(norm, 1e-9);
  return out.map((x) => x / denom);
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

class Mutex {
  private chain: Promise<void> = Promise.resolve();

  run<T>(fn: () => T | Promise<T>): Promise<T> {
    const result = this.chain.then(fn, fn);
    this.chain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

export class VectorStore {
  private indexPath: string;
  private dim: number;
  private vectors: number[][] = [];
  private metadata: Record<number, VectorMeta> = {};
  private lock = new Mutex();

  constructor(indexPath = settings.faissIndexPath, dim = settings.embeddingDim) {
    this.indexPath = path.resolve(indexPath);
    this.dim = dim;
    fs.mkdirSync(this.indexPath, { recursive: true });
    this.load();
  }

  private indexFile() {
    return path.join(this.indexPath, "index.json");
  }

  private metaFile() {
    return path.join(this.indexPath, "meta.json");
  }

  private load() {
    const idx = this.indexFile();
    const meta = this.metaFile();
    if (fs.existsSync(idx) && fs.existsSync(meta)) {
      this.vectors = JSON.parse(fs.readFileSync(idx, "utf8"));
      const raw = JSON.parse(fs.readFileSync(meta, "utf8")) as Record<string, VectorMeta>;
      this.metadata = Object.fromEntries(Object.entries(raw).map(([k, v]) => [Number(k), v]));
      logger.info("faiss_index_loaded", { vectors: this.vectors.length });
    } else {
      this.vectors = [];
      this.metadata = {};
      logger.info("faiss_index_created", { dim: this.dim });
    }
  }

  private save() {
    fs.writeFileSync(this.indexFile(), JSON.stringify(this.vectors));
    fs.writeFileSync(this.metaFile(), JSON.stringify(this.metadata));
  }

  get totalVectors() {
    return this.vectors.length;
  }

  addVectors(embeddings: number[][], metadataList: VectorMeta[]): Promise<number[]> {
    return this.lock.run(() => {
      const startId = this.vectors.length;
      this.vectors.push(...embeddings);
      const faissIds = embeddings.map((_, i) => startId + i);
      faissIds.forEach((fid, i) => {
        this.metadata[fid] = metadataList[i];
      });
      this.save();
      return faissIds;
    });
  }

  replaceAll(embeddings: number[][], metadataList: VectorMeta[]): Promise<void> {
    return this.lock.run(() => {
      this.vectors = embeddings;
      this.metadata = {};
      metadataList.forEach((meta, i) => {
        this.metadata[i] = meta;
      });
      this.save();
    });
  }

  search(queryVector: number[], topK = 5, paperIds?: number[] | null): Promise<SearchHit[]> {
    return this.lock.run(() => {
      if (!this.vectors.length) return [];
      const fetchK = paperIds?.length ? Math.min(topK * 10, this.vectors.length) : Math.min(topK, this.vectors.length);

      const scored = this.vectors.map((vec, idx) => ({
        idx,
        score: dot(queryVector, vec),
      }));
      scored.sort((a, b) => b.score - a.score);

      const results: SearchHit[] = [];
      for (const { idx, score } of scored) {
        const meta = this.metadata[idx];
        if (!meta) continue;
        if (paperIds?.length && !paperIds.includes(meta.paper_id)) continue;
        results.push({ faiss_id: idx, score, ...meta });
        if (results.length >= topK) break;
        if (!paperIds?.length && results.length >= fetchK) break;
      }
      return results;
    });
  }

  deleteByPaper(paperId: number): Promise<void> {
    return this.lock.run(() => {
      const keep = Object.entries(this.metadata)
        .filter(([, m]) => m.paper_id !== paperId)
        .map(([fid]) => Number(fid));
      if (keep.length === Object.keys(this.metadata).length) return;

      const newVectors: number[][] = [];
      const newMeta: Record<number, VectorMeta> = {};
      keep.forEach((oldId, newId) => {
        newVectors.push(this.vectors[oldId]);
        newMeta[newId] = this.metadata[oldId];
      });
      this.vectors = newVectors;
      this.metadata = newMeta;
      this.save();
    });
  }
}

export function averageEmbedding(embeddings: number[][]): number[] {
  return mean(embeddings);
}

let storeInstance: VectorStore | null = null;

export function getFaissStore(): VectorStore {
  if (!storeInstance) storeInstance = new VectorStore();
  return storeInstance;
}

export function resetFaissStoreForTests(indexPath: string, dim = settings.embeddingDim) {
  storeInstance = new VectorStore(indexPath, dim);
  return storeInstance;
}
