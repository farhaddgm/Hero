import { checksum, createNotionSyncService, hasDocumentMarker, legacyChecksum, renderNotionDocumentContent } from "./notion-sync.mjs";

function copy(value) {
  return Object.freeze(structuredClone(value));
}

function sleep(ms) {
  return ms > 0 ? new Promise(resolve => setTimeout(resolve, ms)) : Promise.resolve();
}

export class NotionBatchSyncError extends Error {
  constructor(code, message, statusCode = 400) {
    super(message);
    this.name = "NotionBatchSyncError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function createNotionBatchSyncService({ adapter, mappingStore, now = () => new Date().toISOString(), sleepImpl = sleep } = {}) {
  if (!adapter || typeof adapter.configured !== "boolean") throw new NotionBatchSyncError("NOTION_ADAPTER_REQUIRED", "A Notion adapter is required.", 500);
  if (!mappingStore || typeof mappingStore.get !== "function" || typeof mappingStore.put !== "function") throw new NotionBatchSyncError("MAPPING_STORE_REQUIRED", "A mapping store is required.", 500);
  async function withRetry(operation, label) {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        const retryable = error?.code === "NOTION_RATE_LIMITED" || Number(error?.statusCode ?? 0) >= 500;
        if (!retryable || attempt === maxAttempts) throw error;
        const retryAfterSeconds = Number(error?.details?.retryAfter ?? 0);
        const delay = Math.min(5_000, retryAfterSeconds > 0 ? retryAfterSeconds * 1_000 : 250 * (2 ** (attempt - 1)));
        await sleepImpl(delay);
      }
    }
    throw new NotionBatchSyncError("RETRY_EXHAUSTED", `Retry limit exhausted for ${label}.`);
  }

  const resilientAdapter = Object.freeze({
    configured: adapter.configured,
    getMarkdownPage: (...args) => withRetry(() => adapter.getMarkdownPage(...args), "get-markdown"),
    createMarkdownPage: (...args) => withRetry(() => adapter.createMarkdownPage(...args), "create-markdown"),
    updateMarkdownPage: (...args) => withRetry(() => adapter.updateMarkdownPage(...args), "update-markdown"),
    searchPages: (...args) => withRetry(() => adapter.searchPages(...args), "search-pages")
  });
  const singleSync = createNotionSyncService({ adapter: resilientAdapter, now });

  function plan({ documents = [], policy = {}, batchSize = 10 } = {}) {
    if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100) throw new NotionBatchSyncError("INVALID_BATCH_SIZE", "batchSize must be between 1 and 100.");
    const allowed = new Set((policy.allowed_classifications ?? ["internal"]).map(String));
    const allowlisted = new Set((policy.documents ?? []).filter(item => item.external_write_approved === true).map(item => item.document_id));
    const candidates = documents.filter(document => document.notionEligible !== false && allowed.has(document.classification ?? "internal"));
    const operations = candidates.map((document, index) => copy({
      documentId: document.id,
      title: document.title,
      classification: document.classification ?? "internal",
      editPolicy: document.editClass,
      sourceChecksum: checksum(renderNotionDocumentContent(document, document.content ?? ""), document.title),
      allowlisted: allowlisted.has(document.id),
      batch: Math.floor(index / batchSize) + 1,
      status: allowlisted.has(document.id) ? "approved-candidate" : "approval-required"
    }));
    return copy({
      mode: "dry-run",
      generatedAt: now(),
      batchSize,
      candidates: operations,
      summary: {
        candidateCount: operations.length,
        approvedCandidateCount: operations.filter(item => item.allowlisted).length,
        approvalRequiredCount: operations.filter(item => !item.allowlisted).length,
        batchCount: Math.ceil(operations.length / batchSize)
      }
    });
  }

  async function execute({ documents = [], policy = {}, parentPageId, batchSize = 10, allowExternalWrite = false, bulkWriteApproved = false, runtimeBulkWriteApproved = false, interRequestDelayMs = 250 } = {}) {
    if (!allowExternalWrite || !bulkWriteApproved || !runtimeBulkWriteApproved) throw new NotionBatchSyncError("BULK_EXTERNAL_WRITE_NOT_AUTHORIZED", "Bulk Notion sync requires policy, runtime and operation authorization.", 403);
    if (!adapter.configured) throw new NotionBatchSyncError("NOTION_NOT_CONFIGURED", "Notion connector is not configured.", 503);
    if (typeof parentPageId !== "string" || parentPageId.trim() === "") throw new NotionBatchSyncError("NOTION_PARENT_REQUIRED", "parentPageId is required.");
    const selected = plan({ documents, policy, batchSize }).candidates.filter(item => item.allowlisted);
    const results = [];
    for (const item of selected) {
      const document = documents.find(candidate => candidate.id === item.documentId);
      const sourceChecksum = item.sourceChecksum;
      const legacySourceChecksum = checksum(document.content ?? "", document.title);
      const legacyRawSourceChecksum = legacyChecksum(document.content ?? "", document.title);
      const mapped = await mappingStore.get(document.id);
      let pageId = mapped?.pageId ?? null;
      let pageUrl = null;
      if (pageId) {
        const current = await resilientAdapter.getMarkdownPage(pageId);
        const currentChecksum = checksum(current?.markdown, document.title);
        const currentLegacyChecksum = legacyChecksum(current?.markdown, document.title);
        if (currentChecksum === sourceChecksum) {
          await mappingStore.put({ ...mapped, sourceChecksum, notionChecksum: currentChecksum, canonicalCommit: document.sourceCommit ?? "unknown", status: "in-sync", updatedAt: now() });
          results.push(copy({ documentId: document.id, outcome: "already-in-sync", pageId, sourceChecksum, notionChecksum: currentChecksum }));
          continue;
        }
        const mappedContentMatches = mapped.notionChecksum && (currentChecksum === mapped.notionChecksum || currentLegacyChecksum === mapped.notionChecksum);
        if (mapped.notionChecksum && !mappedContentMatches) {
          await mappingStore.put({ ...mapped, status: "conflict", updatedAt: now() });
          results.push(copy({ documentId: document.id, outcome: "conflict", pageId, sourceChecksum, notionChecksum: currentChecksum }));
          continue;
        }
      } else {
        const search = await resilientAdapter.searchPages(document.title, { pageSize: 20 });
        for (const candidate of Array.isArray(search?.results) ? search.results : []) {
          if (!candidate?.id || candidate.id === parentPageId) continue;
          const current = await resilientAdapter.getMarkdownPage(candidate.id);
          const currentChecksum = checksum(current?.markdown, document.title);
          const currentLegacyChecksum = legacyChecksum(current?.markdown, document.title);
          const identified = hasDocumentMarker(current?.markdown, document.id) || currentChecksum === sourceChecksum || currentChecksum === legacySourceChecksum || currentLegacyChecksum === legacyRawSourceChecksum;
          if (!identified) continue;
          if (currentChecksum !== sourceChecksum && currentChecksum !== legacySourceChecksum && currentLegacyChecksum !== legacyRawSourceChecksum) {
            await mappingStore.put({ documentId: document.id, pageId: candidate.id, canonicalCommit: document.sourceCommit ?? "unknown", sourceChecksum, notionChecksum: currentChecksum, status: "conflict", editPolicy: document.editClass, updatedAt: now() });
            results.push(copy({ documentId: document.id, outcome: "conflict", pageId: candidate.id, sourceChecksum, notionChecksum: currentChecksum }));
            pageId = null;
          } else {
            pageId = candidate.id;
            if (currentChecksum === sourceChecksum) {
              await mappingStore.put({ documentId: document.id, pageId, canonicalCommit: document.sourceCommit ?? "unknown", sourceChecksum, notionChecksum: currentChecksum, status: "in-sync", editPolicy: document.editClass, lastSuccessfulSync: now(), updatedAt: now() });
              results.push(copy({ documentId: document.id, outcome: "already-in-sync", pageId, sourceChecksum, notionChecksum: currentChecksum }));
            }
          }
          break;
        }
        if (results.at(-1)?.documentId === document.id) {
          await sleepImpl(interRequestDelayMs);
          continue;
        }
      }
      if (pageId === null || pageId) {
        await sleepImpl(interRequestDelayMs);
        const synced = await singleSync.syncDocument({ document, content: document.content, parentPageId, pageId, mode: "execute", allowExternalWrite: true });
        pageId = synced.notion?.pageId ?? pageId;
        pageUrl = synced.result?.url ?? null;
        const notionChecksum = synced.notion?.checksum ?? sourceChecksum;
        await mappingStore.put({ documentId: document.id, pageId, canonicalCommit: document.sourceCommit ?? "unknown", sourceChecksum, notionChecksum, status: sourceChecksum === notionChecksum ? "in-sync" : "blocked", editPolicy: document.editClass, lastSuccessfulSync: sourceChecksum === notionChecksum ? now() : null, updatedAt: now() });
        results.push(copy({ documentId: document.id, outcome: "synced", pageId, pageUrl, sourceChecksum, notionChecksum }));
      }
    }
    return copy({ mode: "executed", generatedAt: now(), results, summary: { total: results.length, synced: results.filter(item => item.outcome === "synced").length, alreadyInSync: results.filter(item => item.outcome === "already-in-sync").length, conflicts: results.filter(item => item.outcome === "conflict").length } });
  }

  return Object.freeze({ plan, execute });
}
