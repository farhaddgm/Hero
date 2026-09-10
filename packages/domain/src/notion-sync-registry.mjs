import { validateNotionSyncMapping } from "../../contracts/src/index.mjs";

function immutable(value) {
  return Object.freeze(structuredClone(value));
}

export class NotionSyncRegistryError extends Error {
  constructor(code, message, statusCode = 400) {
    super(message);
    this.name = "NotionSyncRegistryError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function createNotionSyncRegistry({ now = () => new Date().toISOString() } = {}) {
  const mappings = new Map();

  function put(mapping) {
    const errors = validateNotionSyncMapping(mapping);
    if (errors.length > 0) throw new NotionSyncRegistryError("INVALID_NOTION_MAPPING", errors.join(" "));
    const existing = mappings.get(mapping.documentId);
    if (existing && existing.pageId !== mapping.pageId) throw new NotionSyncRegistryError("DOCUMENT_ALREADY_MAPPED", `Document ${mapping.documentId} is already mapped to another Notion page.`, 409);
    const next = immutable({ ...existing, ...mapping, lastSuccessfulSync: mapping.lastSuccessfulSync ?? existing?.lastSuccessfulSync ?? null, updatedAt: mapping.updatedAt ?? now() });
    mappings.set(next.documentId, next);
    return next;
  }

  function get(documentId) {
    return mappings.get(documentId) ?? null;
  }

  function list() {
    return Object.freeze([...mappings.values()].sort((left, right) => left.documentId.localeCompare(right.documentId)));
  }

  function compare({ documentId, sourceChecksum, notionChecksum, canonicalCommit } = {}) {
    const mapping = get(documentId);
    if (!mapping) return immutable({ documentId, state: "pending", reason: "mapping-missing", exact: false });
    const sourceMatches = mapping.sourceChecksum === sourceChecksum;
    const notionMatches = mapping.notionChecksum === notionChecksum;
    const commitMatches = canonicalCommit === undefined || mapping.canonicalCommit === canonicalCommit;
    let state = "conflict";
    let reason = "source-and-notion-diverged";
    if (sourceMatches && notionMatches && commitMatches) {
      state = "in-sync";
      reason = "checksums-and-commit-match";
    } else if (!sourceMatches && notionMatches) {
      state = "source-ahead";
      reason = "canonical-source-changed";
    } else if (sourceMatches && !notionMatches) {
      state = "notion-ahead";
      reason = "notion-edit-detected";
    }
    return immutable({ documentId, pageId: mapping.pageId, state, reason, exact: state === "in-sync", sourceMatches, notionMatches, commitMatches });
  }

  return Object.freeze({ put, get, list, compare });
}
