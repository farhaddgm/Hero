import assert from "node:assert/strict";
import test from "node:test";

import { createPostgresNotionSyncStore } from "../packages/adapters/src/postgresql-notion-sync-store.mjs";
import { createNotionBatchSyncService } from "../packages/domain/src/notion-batch-sync.mjs";
import { createNotionSyncRegistry } from "../packages/domain/src/notion-sync-registry.mjs";

const checksum = "a".repeat(64);

test("PostgreSQL Notion mapping store validates and persists the current mapping", async () => {
  const row = {
    document_id: "HERO-PRODUCT-HERO-BRIEF",
    page_id: "b55c9c91-384d-452b-81db-d1ef79372b75",
    canonical_commit: "commit-a",
    source_checksum: checksum,
    notion_checksum: checksum,
    sync_state: "in-sync",
    edit_policy: "proposal-editable",
    last_successful_sync: "2026-09-10T12:00:00.000Z",
    updated_at: "2026-09-10T12:00:00.000Z",
    data: {}
  };
  const queries = [];
  const client = { async query(text, values) { queries.push({ text, values }); if (text.startsWith("INSERT INTO")) return { rows: [row] }; if (text.startsWith("SELECT document_id")) return { rows: [row] }; return { rows: [] }; } };
  const store = createPostgresNotionSyncStore({ client, now: () => "2026-09-10T12:00:00.000Z" });
  const mapping = await store.upsert({ documentId: row.document_id, pageId: row.page_id, canonicalCommit: row.canonical_commit, sourceChecksum: row.source_checksum, notionChecksum: row.notion_checksum, status: row.sync_state, editPolicy: row.edit_policy });
  assert.equal(mapping.status, "in-sync");
  assert.equal((await store.get(row.document_id)).pageId, row.page_id);
  assert.equal((await store.list()).length, 1);
  assert.equal(queries.length, 3);
});

test("Notion batch sync is dry-run by default and blocks unauthorized bulk writes", async () => {
  const adapter = { configured: true };
  const mappings = createNotionSyncRegistry();
  const batch = createNotionBatchSyncService({ adapter, mappingStore: mappings, now: () => "2026-09-10T12:00:00.000Z" });
  const documents = [
    { id: "HERO-DOCUMENT-ONE", title: "One", content: "Document ID: `HERO-DOCUMENT-ONE`\n", classification: "internal", notionEligible: true, editClass: "proposal-editable", sourceCommit: "commit-a" },
    { id: "HERO-DOCUMENT-TWO", title: "Two", content: "Document ID: `HERO-DOCUMENT-TWO`\n", classification: "internal", notionEligible: true, editClass: "mirror-only", sourceCommit: "commit-a" }
  ];
  const plan = batch.plan({ documents, policy: { allowed_classifications: ["internal"], documents: [{ document_id: "HERO-DOCUMENT-ONE", external_write_approved: true }] }, batchSize: 1 });
  assert.equal(plan.summary.candidateCount, 2);
  assert.equal(plan.summary.approvalRequiredCount, 1);
  await assert.rejects(() => batch.execute({ documents, policy: { allowed_classifications: ["internal"], documents: [] }, parentPageId: "b55c9c91-384d-452b-81db-d1ef79372b75" }), error => error.code === "BULK_EXTERNAL_WRITE_NOT_AUTHORIZED");
});

test("Notion batch sync retries bounded rate limits and freezes a changed mapped page", async () => {
  const delays = [];
  let searches = 0;
  const adapter = {
    configured: true,
    async searchPages() {
      searches += 1;
      if (searches === 1) {
        const error = new Error("rate limited");
        error.code = "NOTION_RATE_LIMITED";
        error.details = { retryAfter: "0" };
        throw error;
      }
      return { results: [] };
    },
    async createMarkdownPage() { return { id: "b55c9c91-384d-452b-81db-d1ef79372b75", url: "https://app.notion.com/p/hero", markdown: "# One" }; },
    async getMarkdownPage() { return { markdown: "# changed" }; },
    async updateMarkdownPage() { throw new Error("must not overwrite a changed page"); }
  };
  const mappings = createNotionSyncRegistry();
  const batch = createNotionBatchSyncService({ adapter, mappingStore: mappings, sleepImpl: async value => delays.push(value), now: () => "2026-09-10T12:00:00.000Z" });
  const document = { id: "HERO-DOCUMENT-ONE", title: "One", content: "Document ID: `HERO-DOCUMENT-ONE`\n", classification: "internal", notionEligible: true, editClass: "proposal-editable", sourceCommit: "commit-a" };
  const policy = { allowed_classifications: ["internal"], documents: [{ document_id: document.id, external_write_approved: true }] };
  const synced = await batch.execute({ documents: [document], policy, parentPageId: "b55c9c91-384d-452b-81db-d1ef79372b75", allowExternalWrite: true, bulkWriteApproved: true, runtimeBulkWriteApproved: true, interRequestDelayMs: 1 });
  assert.equal(synced.summary.synced, 1);
  assert.equal(searches, 2);
  assert.ok(delays.includes(250));

  const conflictMappings = createNotionSyncRegistry();
  conflictMappings.put({ documentId: document.id, pageId: "b55c9c91-384d-452b-81db-d1ef79372b75", canonicalCommit: "commit-old", sourceChecksum: "a".repeat(64), notionChecksum: "b".repeat(64), status: "in-sync", editPolicy: "proposal-editable" });
  const conflict = await createNotionBatchSyncService({ adapter: { ...adapter, async searchPages() { return { results: [] }; } }, mappingStore: conflictMappings, sleepImpl: async () => {} }).execute({ documents: [document], policy, parentPageId: "b55c9c91-384d-452b-81db-d1ef79372b75", allowExternalWrite: true, bulkWriteApproved: true, runtimeBulkWriteApproved: true });
  assert.equal(conflict.summary.conflicts, 1);
});
