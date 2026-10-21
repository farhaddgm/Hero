import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";

import {
  CHECKPOINT_INTEGRITY_FAILED,
  CHECKPOINT_SIGNING_UNAVAILABLE,
  CheckpointIntegrityError,
  createCheckpointIntegrity,
  createSecretStoreKeyResolver,
  digestCheckpointContent
} from "../packages/domain/src/checkpoint-integrity.mjs";

// Keys are generated while the test runs, so no key-shaped literal exists in the repository (PR 20 pattern).
const keys = { "key-one": randomBytes(32), "key-two": randomBytes(32) };
const now = () => "2026-10-21T12:00:00.000Z";
const resolver = id => keys[id] ?? null;
const make = (options = {}) => createCheckpointIntegrity({ keyResolver: resolver, currentKeyId: "key-one", now, ...options });
const base = { checkpointId: "checkpoint-001", runId: "run-alpha", taskId: "task-build", runnerId: "runner-one", content: { files: ["a.mjs"], progress: 40 } };
const verifyArgs = (record, content = base.content, extra = {}) => ({ record, content, runId: base.runId, taskId: base.taskId, runnerId: base.runnerId, ...extra });
const failed = result => { assert.equal(result.ok, false); assert.equal(result.code, CHECKPOINT_INTEGRITY_FAILED); return result.reason; };

test("a signed checkpoint verifies, and content digests do not depend on key order", () => {
  const integrity = make();
  const record = integrity.sign(base);
  assert.equal(record.sequence, 1);
  assert.equal(record.previousMac, "genesis");
  assert.equal(record.keyId, "key-one");
  assert.match(record.mac, /^[0-9a-f]{64}$/);
  const verdict = integrity.verify(verifyArgs(record));
  assert.equal(verdict.ok, true);
  assert.equal(verdict.chainChecked, false);
  assert.equal(integrity.verify(verifyArgs(record, { progress: 40, files: ["a.mjs"] })).ok, true, "key order is irrelevant");
  assert.equal(digestCheckpointContent("x"), digestCheckpointContent(Buffer.from("x")));
  assert.throws(() => Object.assign(record, { mac: "0" }), TypeError, "a record is immutable");
});

test("one changed byte, a moved checkpoint and an unknown key all fail with CHECKPOINT_INTEGRITY_FAILED", () => {
  const integrity = make();
  const record = integrity.sign(base);
  assert.equal(failed(integrity.verify(verifyArgs(record, { files: ["a.mjs"], progress: 41 }))), "content-modified");
  assert.equal(failed(integrity.verify(verifyArgs(record, { ...base.content, extra: 1 }))), "content-modified");
  assert.equal(failed(integrity.verify({ ...verifyArgs(record), taskId: "task-other" })), "binding-mismatch", "moved to another task");
  assert.equal(failed(integrity.verify({ ...verifyArgs(record), runId: "run-beta" })), "binding-mismatch", "moved to another run");
  assert.equal(failed(integrity.verify({ ...verifyArgs(record), runnerId: "runner-two" })), "binding-mismatch");
  const unknown = integrity.verify(verifyArgs({ ...record, keyId: "key-gone" }));
  assert.equal(failed(unknown), "unknown-key");
  assert.equal(unknown.keyId, "key-gone");
  assert.equal(failed(integrity.verify(verifyArgs({ ...record, keyId: "key-two" }))), "bad-signature", "a different known key does not validate it");
  for (const patch of [{ sequence: 2 }, { signedAt: "2026-10-22T00:00:00.000Z" }, { previousMac: "a".repeat(64) }, { checkpointId: "checkpoint-002" }, { contentDigest: "b".repeat(64) }]) {
    const reason = failed(integrity.verify(verifyArgs({ ...record, ...patch })));
    assert.ok(["bad-signature", "content-modified"].includes(reason), JSON.stringify(patch));
  }
  assert.equal(failed(integrity.verify(verifyArgs({ ...record, mac: "A".repeat(64) }))), "malformed-record");
  assert.equal(failed(integrity.verify(verifyArgs({ ...record, mac: record.mac.slice(0, 62) }))), "malformed-record");
  assert.equal(failed(integrity.verify(verifyArgs(null))), "malformed-record");
  assert.equal(failed(integrity.verify(verifyArgs({ ...record, schema: "other" }))), "malformed-record");
  assert.equal(failed(integrity.verify(verifyArgs(record, Buffer.alloc(0)))), "content-unreadable");
  assert.equal(failed(integrity.verify(verifyArgs(record, 42))), "content-unreadable");
});

test("checkpoints are chained: skipping, replaying and re-rooting are detected", () => {
  const integrity = make();
  const first = integrity.sign(base);
  const second = integrity.sign({ ...base, checkpointId: "checkpoint-002", content: { progress: 60 }, previous: first });
  const third = integrity.sign({ ...base, checkpointId: "checkpoint-003", content: { progress: 80 }, previous: second });
  assert.equal(second.sequence, 2);
  assert.equal(second.previousMac, first.mac);
  assert.equal(integrity.verify(verifyArgs(first, base.content, { previous: null })).ok, true);
  assert.equal(integrity.verify(verifyArgs(second, { progress: 60 }, { previous: first })).chainChecked, true);
  assert.equal(integrity.verify(verifyArgs(third, { progress: 80 }, { previous: second })).ok, true);
  assert.equal(failed(integrity.verify(verifyArgs(third, { progress: 80 }, { previous: first }))), "chain-break", "a checkpoint was skipped");
  assert.equal(failed(integrity.verify(verifyArgs(second, { progress: 60 }, { previous: null }))), "chain-break", "not a first checkpoint");
  assert.equal(failed(integrity.verify(verifyArgs(first, base.content, { previous: second }))), "chain-break", "replayed older checkpoint");
  assert.throws(() => integrity.sign({ ...base, taskId: "task-other", previous: first }), error => error instanceof CheckpointIntegrityError && error.reason === "binding-mismatch");
});

test("keys rotate without losing old checkpoints, and removing a key is a failure, not a pass", () => {
  const before = make();
  const old = before.sign(base);
  const rotated = make({ currentKeyId: "key-two" });
  const fresh = rotated.sign({ ...base, checkpointId: "checkpoint-002", previous: old });
  assert.equal(fresh.keyId, "key-two");
  assert.equal(rotated.verify(verifyArgs(old)).ok, true, "the old checkpoint still verifies after rotation");
  assert.equal(rotated.verify(verifyArgs(fresh, base.content, { previous: old })).ok, true, "a chain may span a rotation");
  const retired = createCheckpointIntegrity({ keyResolver: id => (id === "key-two" ? keys["key-two"] : null), currentKeyId: "key-two", now });
  assert.equal(failed(retired.verify(verifyArgs(old))), "unknown-key", "a retired key makes old checkpoints fail closed");
});

test("without a usable key the capability is unavailable and never claims a checkpoint is sound", () => {
  const record = make().sign(base);
  const none = createCheckpointIntegrity({ now });
  assert.deepEqual({ ...none.status() }, { available: false, currentKeyId: null, code: CHECKPOINT_SIGNING_UNAVAILABLE });
  assert.throws(() => none.sign(base), error => error.code === CHECKPOINT_SIGNING_UNAVAILABLE);
  const verdict = none.verify(verifyArgs(record));
  assert.equal(verdict.ok, false);
  assert.equal(verdict.unavailable, true);
  assert.equal(verdict.code, CHECKPOINT_SIGNING_UNAVAILABLE);
  const weak = createCheckpointIntegrity({ keyResolver: () => "too-short", currentKeyId: "key-one", now });
  assert.equal(weak.status().available, false, "a short key is not a key");
  assert.throws(() => weak.sign(base), error => error.code === CHECKPOINT_SIGNING_UNAVAILABLE);
  const throwing = createCheckpointIntegrity({ keyResolver: () => { throw new Error("vault down"); }, currentKeyId: "key-one", now });
  assert.equal(throwing.status().available, false);
  assert.equal(failed(throwing.verify(verifyArgs(record))), "unknown-key", "a failing key lookup fails closed and leaks nothing");
  assert.equal(make({ currentKeyId: "not a valid id" }).status().available, false);
  assert.equal(make({ currentKeyId: "key-missing" }).status().available, false);
});

test("the key value never appears in a record or an error", () => {
  const integrity = make();
  const record = integrity.sign(base);
  const keyHex = keys["key-one"].toString("hex");
  const keyBase64 = keys["key-one"].toString("base64");
  const text = JSON.stringify(record);
  assert.equal(text.includes(keyHex) || text.includes(keyBase64), false);
  assert.equal(JSON.stringify(integrity.verify(verifyArgs({ ...record, keyId: "key-gone" }))).includes(keyHex), false);
  const error = (() => { try { make({ currentKeyId: "key-missing" }).sign(base); } catch (caught) { return caught; } return null; })();
  assert.ok(error);
  assert.equal(String(error.message).includes(keyHex), false);
});

test("input validation rejects bad ids and bad content", () => {
  const integrity = make();
  for (const patch of [{ checkpointId: "x" }, { runId: "bad id" }, { taskId: 7 }, { runnerId: "" }]) assert.throws(() => integrity.sign({ ...base, ...patch }), error => error.code === "INVALID_IDENTIFIER", JSON.stringify(patch));
  for (const content of [undefined, null, 5, "", Buffer.alloc(0), "x".repeat(300_000)]) assert.throws(() => integrity.sign({ ...base, content }), error => error.code === "INVALID_CONTENT");
});

test("resume is allowed only for a checkpointed Runner holding exactly this valid checkpoint, and a failure leaves it where it is", () => {
  const integrity = make();
  const record = integrity.sign(base);
  const runner = { runnerId: "runner-one", state: "checkpointed", checkpoint: { id: "checkpoint-001", summary: null, recordedAt: now() } };
  const allowed = integrity.guardResume({ runner, record, content: base.content });
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.runnerState, "checkpointed");
  const tampered = integrity.guardResume({ runner, record, content: { ...base.content, progress: 99 } });
  assert.equal(tampered.allowed, false);
  assert.equal(tampered.code, CHECKPOINT_INTEGRITY_FAILED);
  assert.equal(tampered.reason, "content-modified");
  assert.equal(tampered.runnerState, "checkpointed", "the Runner stays in its safe state");
  assert.equal(integrity.guardResume({ runner: { ...runner, state: "running" }, record, content: base.content }).reason, "runner-not-checkpointed");
  assert.equal(integrity.guardResume({ runner: { ...runner, checkpoint: null }, record, content: base.content }).allowed, false);
  assert.equal(integrity.guardResume({ runner: { ...runner, checkpoint: { id: "checkpoint-777" } }, record, content: base.content }).reason, "binding-mismatch");
  assert.equal(integrity.guardResume({ runner: { ...runner, runnerId: "runner-two" }, record, content: base.content }).reason, "binding-mismatch");
  assert.equal(integrity.guardResume({ runner, record: null, content: base.content }).allowed, false);
  assert.equal(integrity.guardResume({}).allowed, false);
  assert.equal(createCheckpointIntegrity({ now }).guardResume({ runner, record, content: base.content }).code, CHECKPOINT_SIGNING_UNAVAILABLE, "no key means no resume, not a pass");
});

test("the Secret Store adapter returns only mapped keys, swallows store errors and never invents a key", () => {
  const reads = [];
  const store = { get: ({ credentialRef }) => { reads.push(credentialRef); if (credentialRef === "vault:hero/test/hero-checkpoint/missing") throw new Error("not configured"); return keys["key-one"]; } };
  const resolveFromStore = createSecretStoreKeyResolver({ secretStore: store, references: { "key-one": "vault:hero/test/hero-checkpoint/default", "key-gone": "vault:hero/test/hero-checkpoint/missing" } });
  assert.equal(Buffer.compare(Buffer.from(resolveFromStore("key-one")), keys["key-one"]), 0);
  assert.equal(resolveFromStore("key-gone"), null);
  assert.equal(resolveFromStore("key-unmapped"), null);
  assert.equal(resolveFromStore("__proto__"), null);
  assert.deepEqual(reads, ["vault:hero/test/hero-checkpoint/default", "vault:hero/test/hero-checkpoint/missing"], "unmapped ids never reach the store");
  const integrity = createCheckpointIntegrity({ keyResolver: resolveFromStore, currentKeyId: "key-one", now });
  assert.equal(integrity.verify(verifyArgs(integrity.sign(base))).ok, true);
  assert.throws(() => createSecretStoreKeyResolver({}), TypeError);
  assert.throws(() => createSecretStoreKeyResolver({ secretStore: store }), TypeError);
});
