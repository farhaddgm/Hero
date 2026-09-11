import assert from "node:assert/strict";
import test from "node:test";

import { createPostgresNotionSyncStore } from "../packages/adapters/src/postgresql-notion-sync-store.mjs";
import { createNotionBatchSyncService } from "../packages/domain/src/notion-batch-sync.mjs";
import { createNotionSyncRegistry } from "../packages/domain/src/notion-sync-registry.mjs";
import { checksum as markdownChecksum, renderNotionDocumentContent } from "../packages/domain/src/notion-sync.mjs";

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

test("Notion projection adds an identity marker and recognizes a legacy unmarked page", async () => {
  const document = { id: "HERO-DOCUMENT-LEGACY", title: "Legacy", content: "# Legacy\nBody\n", classification: "internal", notionEligible: true, editClass: "proposal-editable", sourceCommit: "commit-a" };
  const legacyContent = document.content;
  let stored = { markdown: legacyContent };
  const legacyPageId = "c66d9c91-384d-452b-81db-d1ef79372b75";
  const adapter = {
    configured: true,
    async searchPages() { return { results: [{ id: legacyPageId }] }; },
    async getMarkdownPage() { return stored; },
    async updateMarkdownPage(_pageId, payload) { stored = { markdown: payload.replace_content.new_str }; return { id: legacyPageId, markdown: stored.markdown }; },
    async createMarkdownPage() { throw new Error("must not create a duplicate page"); }
  };
  const mappings = createNotionSyncRegistry();
  const policy = { allowed_classifications: ["internal"], documents: [{ document_id: document.id, external_write_approved: true }] };
  const result = await createNotionBatchSyncService({ adapter, mappingStore: mappings, sleepImpl: async () => {}, now: () => "2026-09-11T00:00:00.000Z" }).execute({ documents: [document], policy, parentPageId: "b55c9c91-384d-452b-81db-d1ef79372b75", allowExternalWrite: true, bulkWriteApproved: true, runtimeBulkWriteApproved: true });
  assert.equal(result.summary.synced, 1);
  assert.match(stored.markdown, /Hero Document ID: `HERO-DOCUMENT-LEGACY`/);
  assert.equal(renderNotionDocumentContent(document, stored.markdown), stored.markdown);
});

test("Notion checksum treats API markdown normalization as the same projection", () => {
  const source = [
    "> Hero Document ID: `HERO-DOCUMENT-TABLE`",
    "",
    "# Table",
    "",
    "```text",
    "example",
    "```",
    "",
    "[Guide](guide.md)",
    "",
    "| Name | State |",
    "| --- | --- |",
    "| Hero | active |"
  ].join("\n");
  const notion = [
    "> Hero Document ID: `HERO-DOCUMENT-TABLE`",
    "# Table",
    "```plain text",
    "example",
    "```",
    "[Guide](https://guide.md)",
    "<table header-row=\"true\">",
    "<tr>",
    "<td>Name</td>",
    "<td>State</td>",
    "</tr>",
    "<tr>",
    "<td>Hero</td>",
    "<td>active</td>",
    "</tr>",
    "</table>"
  ].join("\n");
  assert.equal(markdownChecksum(source, "Table"), markdownChecksum(notion, "Table"));
});

test("Notion checksum treats footnote references as the same projection", () => {
  const source = [
    "# References",
    "",
    "A claim.[^1]",
    "    four-space indent",
    "  - nested",
    "",
    "[^1]: Notion. [Guide](https://www.notion.com/help) localhost"
  ].join("\n");
  const notion = [
    "# References",
    "A claim.[\\[1\\]](1)",
    "  four-space indent",
    "\t- nested",
    "[\\[1\\]](1): Notion. [Guide](https://www.notion.com/help) [localhost](http://localhost)"
  ].join("\n");
  assert.equal(markdownChecksum(source, "References"), markdownChecksum(notion, "References"));
});

test("Notion checksum ignores list indentation around fenced code while preserving code indentation", () => {
  const source = [
    "- Configuration:",
    "  ```text",
    "  {",
    "    \"nested\": true",
    "  }",
    "  ```"
  ].join("\n");
  const notion = [
    "- Configuration:",
    "\t```plain text",
    "{",
    "  \"nested\": true",
    "}",
    "\t```"
  ].join("\n");
  assert.equal(markdownChecksum(source), markdownChecksum(notion));
});

test("Notion checksum treats automatic ordered-list renumbering as the same projection", () => {
  const source = ["1. Router", "5. Output"].join("\n");
  const notion = ["1. Router", "2. Output"].join("\n");
  assert.equal(markdownChecksum(source), markdownChecksum(notion));
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
