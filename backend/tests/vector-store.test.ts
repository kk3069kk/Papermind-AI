import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { VectorStore } from "../src/rag/vector-store.js";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "papermind-faiss-"));

describe("vector store", () => {
  after(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("adds, searches, filters, and deletes vectors", async () => {
    const store = new VectorStore(tmp, 4);
    await store.addVectors(
      [
        [1, 0, 0, 0],
        [0.9, 0.1, 0, 0],
        [0, 1, 0, 0],
      ],
      [
        { paper_id: 1, chunk_index: 0 },
        { paper_id: 1, chunk_index: 1 },
        { paper_id: 2, chunk_index: 0 },
      ],
    );

    const hits = await store.search([1, 0, 0, 0], 2);
    assert.equal(hits[0].paper_id, 1);
    assert.ok(hits[0].score > 0.8);

    const filtered = await store.search([1, 0, 0, 0], 5, [2]);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].paper_id, 2);

    await store.deleteByPaper(1);
    const afterDelete = await store.search([1, 0, 0, 0], 5);
    assert.equal(afterDelete.length, 1);
    assert.equal(afterDelete[0].paper_id, 2);
  });
});
