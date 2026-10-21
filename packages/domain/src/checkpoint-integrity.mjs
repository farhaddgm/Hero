import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * NX-009 — signed, chained Runner checkpoints.
 *
 * ADR-0006 requires a checkpoint before cleanup. This module makes a checkpoint tamper-evident:
 * a content digest and a chained HMAC bind it to one Run, one Task and one Runner, so a resume can
 * check that the content did not change between stopping and continuing.
 *
 * - Keys are resolved by id from an injected resolver (e.g. the Secret Store). A key value never
 *   appears in a record, an error or a log; only the key id does.
 * - With no usable key the capability is `unavailable`; it never claims a checkpoint is sound.
 * - A failed check leaves the Runner exactly where it was (safe state); nothing is repaired.
 */

export const CHECKPOINT_INTEGRITY_FAILED = "CHECKPOINT_INTEGRITY_FAILED";
export const CHECKPOINT_SIGNING_UNAVAILABLE = "CHECKPOINT_SIGNING_UNAVAILABLE";
export const CHECKPOINT_RECORD_SCHEMA = "hero.signed-checkpoint/v1";

const IDENTIFIER = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;
const MIN_KEY_BYTES = 32;
const MAX_CONTENT_BYTES = 256 * 1024;
const GENESIS = "genesis";
const HEX64 = /^[0-9a-f]{64}$/;

export class CheckpointIntegrityError extends Error {
  constructor(code, message, reason = null) {
    super(message);
    this.name = "CheckpointIntegrityError";
    this.code = code;
    this.reason = reason;
  }
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  return value;
}

function identifier(label, value) {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) throw new CheckpointIntegrityError("INVALID_IDENTIFIER", `${label} is invalid.`);
  return value;
}

/** Digest of checkpoint content. Objects are digested in a key-order-independent form. */
export function digestCheckpointContent(content) {
  let bytes;
  if (typeof content === "string") bytes = Buffer.from(content, "utf8");
  else if (Buffer.isBuffer(content) || content instanceof Uint8Array) bytes = Buffer.from(content);
  else if (content && typeof content === "object") bytes = Buffer.from(JSON.stringify(stable(content)), "utf8");
  else throw new CheckpointIntegrityError("INVALID_CONTENT", "Checkpoint content must be a string, bytes or a JSON object.");
  if (bytes.length === 0 || bytes.length > MAX_CONTENT_BYTES) throw new CheckpointIntegrityError("INVALID_CONTENT", "Checkpoint content must be 1 byte to 256 KiB.");
  return createHash("sha256").update(bytes).digest("hex");
}

function macInput(record) {
  return ["hero-checkpoint/v1", record.checkpointId, record.runId, record.taskId, record.runnerId, record.sequence, record.contentDigest, record.previousMac, record.keyId, record.signedAt].join("\n");
}

function usableKey(raw) {
  if (typeof raw === "string") return raw.length >= MIN_KEY_BYTES ? Buffer.from(raw, "utf8") : null;
  if (Buffer.isBuffer(raw) || raw instanceof Uint8Array) return raw.length >= MIN_KEY_BYTES ? Buffer.from(raw) : null;
  return null;
}

function safeEqualHex(left, right) {
  if (typeof left !== "string" || typeof right !== "string" || !HEX64.test(left) || !HEX64.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function rejection(reason, extra = {}) {
  return Object.freeze({ ok: false, unavailable: false, code: CHECKPOINT_INTEGRITY_FAILED, reason, ...extra });
}

/**
 * @param {{ keyResolver?: (keyId: string) => (string|Buffer|Uint8Array|null|undefined), currentKeyId?: string, now?: () => string }} options
 * keyResolver returns the key for an id or nothing; currentKeyId names the key new checkpoints are signed with.
 */
export function createCheckpointIntegrity({ keyResolver, currentKeyId, now = () => new Date().toISOString() } = {}) {
  const resolve = keyId => {
    if (typeof keyResolver !== "function" || typeof keyId !== "string" || !IDENTIFIER.test(keyId)) return null;
    try { return usableKey(keyResolver(keyId)); } catch { return null; }
  };

  function status() {
    const available = typeof currentKeyId === "string" && IDENTIFIER.test(currentKeyId) && resolve(currentKeyId) !== null;
    return Object.freeze({ available, currentKeyId: available ? currentKeyId : null, code: available ? null : CHECKPOINT_SIGNING_UNAVAILABLE });
  }

  function sign({ checkpointId, runId, taskId, runnerId, content, previous = null } = {}) {
    identifier("checkpointId", checkpointId);
    identifier("runId", runId);
    identifier("taskId", taskId);
    identifier("runnerId", runnerId);
    const key = typeof currentKeyId === "string" ? resolve(currentKeyId) : null;
    if (!key) throw new CheckpointIntegrityError(CHECKPOINT_SIGNING_UNAVAILABLE, "No usable checkpoint signing key is configured; the capability is unavailable.");
    if (previous !== null && (previous.runId !== runId || previous.taskId !== taskId || previous.runnerId !== runnerId)) {
      throw new CheckpointIntegrityError(CHECKPOINT_INTEGRITY_FAILED, "A checkpoint can only follow a checkpoint of the same Run, Task and Runner.", "binding-mismatch");
    }
    const record = {
      schema: CHECKPOINT_RECORD_SCHEMA,
      checkpointId, runId, taskId, runnerId,
      sequence: previous === null ? 1 : previous.sequence + 1,
      contentDigest: digestCheckpointContent(content),
      previousMac: previous === null ? GENESIS : previous.mac,
      keyId: currentKeyId,
      signedAt: now()
    };
    record.mac = createHmac("sha256", key).update(macInput(record)).digest("hex");
    return Object.freeze(record);
  }

  /**
   * Checks a checkpoint for resume. `previous`: undefined skips the chain check, null requires a first
   * checkpoint, a record requires the checkpoint to follow it.
   */
  function verify({ record, content, runId, taskId, runnerId = undefined, previous = undefined } = {}) {
    if (typeof keyResolver !== "function") return Object.freeze({ ok: false, unavailable: true, code: CHECKPOINT_SIGNING_UNAVAILABLE, reason: "no-key-resolver" });
    const wellFormed = record && typeof record === "object" && record.schema === CHECKPOINT_RECORD_SCHEMA
      && ["checkpointId", "runId", "taskId", "runnerId", "keyId", "signedAt"].every(field => typeof record[field] === "string")
      && Number.isInteger(record.sequence) && record.sequence >= 1
      && HEX64.test(record.contentDigest ?? "") && HEX64.test(record.mac ?? "")
      && (record.previousMac === GENESIS || HEX64.test(record.previousMac ?? ""));
    if (!wellFormed) return rejection("malformed-record");
    if (record.runId !== runId || record.taskId !== taskId || (runnerId !== undefined && record.runnerId !== runnerId)) return rejection("binding-mismatch");
    const key = resolve(record.keyId);
    if (!key) return rejection("unknown-key", { keyId: record.keyId });
    let digest;
    try { digest = digestCheckpointContent(content); } catch { return rejection("content-unreadable"); }
    if (!safeEqualHex(digest, record.contentDigest)) return rejection("content-modified");
    const expected = createHmac("sha256", key).update(macInput(record)).digest("hex");
    if (!safeEqualHex(expected, record.mac)) return rejection("bad-signature");
    if (previous !== undefined) {
      const first = previous === null;
      const follows = first
        ? record.sequence === 1 && record.previousMac === GENESIS
        : previous.runId === record.runId && previous.taskId === record.taskId && record.sequence === previous.sequence + 1 && record.previousMac === previous.mac;
      if (!follows) return rejection("chain-break");
    }
    return Object.freeze({ ok: true, unavailable: false, code: null, reason: null, keyId: record.keyId, sequence: record.sequence, chainChecked: previous !== undefined });
  }

  /**
   * Resume gate. The Runner must be `checkpointed` at exactly this checkpoint. On any failure the Runner stays
   * where it is: this function only answers, it never changes a state and never repairs a checkpoint.
   */
  function guardResume({ runner, record, content, previous = undefined } = {}) {
    const hold = (code, reason) => Object.freeze({ allowed: false, runnerState: runner?.state ?? null, code, reason });
    if (!runner || runner.state !== "checkpointed" || !runner.checkpoint) return hold(CHECKPOINT_INTEGRITY_FAILED, "runner-not-checkpointed");
    if (!record || runner.checkpoint.id !== record.checkpointId || runner.runnerId !== record.runnerId) return hold(CHECKPOINT_INTEGRITY_FAILED, "binding-mismatch");
    const verdict = verify({ record, content, runId: record.runId, taskId: record.taskId, runnerId: runner.runnerId, previous });
    if (!verdict.ok) return hold(verdict.code, verdict.reason);
    return Object.freeze({ allowed: true, runnerState: runner.state, code: null, reason: null });
  }

  return Object.freeze({ status, sign, verify, guardResume });
}

/**
 * Adapts the Secret Store to a key resolver. `references` maps a key id to a credential reference; the
 * resolver returns the key value only to the verifier and never logs or returns a reference's value elsewhere.
 */
export function createSecretStoreKeyResolver({ secretStore, references } = {}) {
  if (!secretStore || typeof secretStore.get !== "function") throw new TypeError("A Secret Store with get() is required.");
  if (!references || typeof references !== "object") throw new TypeError("A key reference map is required.");
  return keyId => {
    if (!Object.hasOwn(references, keyId)) return null;
    try { return secretStore.get({ credentialRef: references[keyId] }); } catch { return null; }
  };
}
