import { createHash } from "node:crypto";

import { auditEntryDigest } from "./agent-tool-gateway.mjs";

/**
 * NX-002 — independent verifier for the hash-chained Agent Tool Gateway audit.
 *
 * Pure and read-only: it recomputes the chain, names the first broken link and the kind of damage
 * (edit, removal, reordering, duplication, truncation), and never repairs or rewrites anything.
 * "Unknown" is never "intact": a missing chain is `unknown`, and a chain without a reference head
 * is only `consistent`, because truncating the tail cannot be seen from the chain alone.
 */

export const AUDIT_CHAIN_STATUSES = Object.freeze(["intact", "consistent", "broken", "unknown"]);

export const AUDIT_FAILURE_CODES = Object.freeze({
  malformed: "AUDIT_MALFORMED",
  edited: "AUDIT_EDITED",
  removed: "AUDIT_REMOVED",
  reordered: "AUDIT_REORDERED",
  duplicated: "AUDIT_DUPLICATED",
  truncated: "AUDIT_TRUNCATED",
  "head-mismatch": "AUDIT_HEAD_MISMATCH"
});

const HASH = /^[0-9a-f]{64}$/;

function isEntry(entry) {
  return Boolean(entry) && typeof entry === "object" && !Array.isArray(entry)
    && typeof entry.hash === "string" && HASH.test(entry.hash)
    && Number.isInteger(entry.seq) && entry.seq >= 1
    && typeof entry.previousHash === "string";
}

function failure(kind, index, detail) {
  return Object.freeze({ kind, code: AUDIT_FAILURE_CODES[kind], index, seq: index + 1, detail });
}

function result({ status, entries, headHash, failure: problem = null, anchored, aheadOfReference = false, reason = null }) {
  const head = headHash ?? null;
  const digest = status === "unknown" || status === "broken"
    ? null
    : createHash("sha256").update(JSON.stringify({ entries, headHash: head })).digest("hex");
  return Object.freeze({
    schema: "hero.audit-chain-verification/v1",
    status,
    ok: status === "intact",
    entries,
    headHash: head,
    anchored,
    aheadOfReference,
    failure: problem,
    reason,
    digest
  });
}

/**
 * @param {unknown} entries gateway audit entries in order
 * @param {{ expectedHead?: { seq: number, hash: string } | null }} options reference head recorded elsewhere
 */
export function verifyAuditChainDetailed(entries, { expectedHead = null } = {}) {
  if (!Array.isArray(entries)) return result({ status: "unknown", entries: 0, headHash: null, anchored: false, reason: "the audit chain is not available" });
  if (expectedHead !== null && (!expectedHead || !Number.isInteger(expectedHead.seq) || expectedHead.seq < 0 || (expectedHead.seq > 0 && !HASH.test(expectedHead.hash ?? "")))) {
    return result({ status: "unknown", entries: entries.length, headHash: null, anchored: false, reason: "the reference head is malformed" });
  }

  const known = new Set(entries.filter(isEntry).map(entry => entry.hash));
  const seen = new Set();
  let previous = "genesis";
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (!isEntry(entry)) return result({ status: "broken", entries: entries.length, headHash: null, anchored: false, failure: failure("malformed", index, "entry is not a well-formed audit record") });
    const { hash, ...body } = entry;
    const selfConsistent = auditEntryDigest(body) === hash;
    const linked = entry.previousHash === previous;
    const sequenced = entry.seq === index + 1;
    if (selfConsistent && linked && sequenced && !seen.has(hash)) {
      seen.add(hash);
      previous = hash;
      continue;
    }
    let kind;
    if (!selfConsistent) kind = "edited";
    else if (seen.has(hash)) kind = "duplicated";
    else if (!linked && known.has(entry.previousHash) && entry.previousHash !== "genesis") kind = "reordered";
    else if (!linked && entry.seq > index + 1) kind = "removed";
    else if (!linked && entry.seq <= index) kind = "reordered";
    else kind = "edited";
    return result({ status: "broken", entries: entries.length, headHash: null, anchored: false, failure: failure(kind, index, `link ${index + 1} does not follow from link ${index}`) });
  }

  const headHash = entries.length === 0 ? "genesis" : previous;
  if (expectedHead === null) {
    return result({ status: "consistent", entries: entries.length, headHash, anchored: false, reason: "no reference head: removal of the newest entries cannot be excluded" });
  }
  if (entries.length < expectedHead.seq) {
    return result({ status: "broken", entries: entries.length, headHash, anchored: true, failure: failure("truncated", entries.length, `the chain ends at link ${entries.length} but the reference head is link ${expectedHead.seq}`) });
  }
  if (entries.length === expectedHead.seq) {
    const matches = expectedHead.seq === 0 ? headHash === "genesis" : previous === expectedHead.hash;
    if (!matches) return result({ status: "broken", entries: entries.length, headHash, anchored: true, failure: failure("head-mismatch", entries.length - 1, "the newest link differs from the reference head") });
    return result({ status: "intact", entries: entries.length, headHash, anchored: true });
  }
  // The chain is longer than the reference: the reference link must still be part of it.
  const atReference = expectedHead.seq === 0 ? "genesis" : entries[expectedHead.seq - 1]?.hash;
  if (atReference !== (expectedHead.seq === 0 ? "genesis" : expectedHead.hash)) {
    return result({ status: "broken", entries: entries.length, headHash, anchored: true, failure: failure("head-mismatch", expectedHead.seq - 1, "the reference link is not part of this chain") });
  }
  return result({ status: "intact", entries: entries.length, headHash, anchored: true, aheadOfReference: true });
}

/** The reader-facing signal for Delivery Truth. Only `intact` is reported as healthy. */
export function auditIntegritySignal(verification) {
  const status = AUDIT_CHAIN_STATUSES.includes(verification?.status) ? verification.status : "unknown";
  const labels = {
    intact: "زنجیرهٔ Audit سالم است و با سر مرجع یکسان است.",
    consistent: "زنجیرهٔ Audit از درون سازگار است، اما سر مرجع ثبت نشده و کوتاه‌شدن انتهای آن قابل رد کردن نیست.",
    broken: `زنجیرهٔ Audit شکسته است (${verification?.failure?.code ?? "AUDIT_MALFORMED"} در حلقهٔ ${verification?.failure?.seq ?? "?"}).`,
    unknown: "وضعیت زنجیرهٔ Audit معلوم نیست؛ این به معنی سالم بودن نیست."
  };
  return Object.freeze({
    status,
    healthy: status === "intact",
    labelFa: labels[status],
    failureCode: verification?.failure?.code ?? null,
    entries: Number.isInteger(verification?.entries) ? verification.entries : null,
    digest: verification?.digest ?? null
  });
}
