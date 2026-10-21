import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createAgentToolGateway } from "../packages/domain/src/agent-tool-gateway.mjs";
import { AUDIT_FAILURE_CODES, auditIntegritySignal, verifyAuditChainDetailed } from "../packages/domain/src/audit-chain-verifier.mjs";
import { createAuthorizationEngine } from "../packages/domain/src/authorization-engine.mjs";
import { computeDeliveryTruth } from "../packages/domain/src/delivery-truth.mjs";
import { runAuditChainCommand } from "../tools/audit-chain.mjs";

const now = () => "2026-10-21T12:00:00.000Z";
const owner = { kind: "project-owner", id: "hero-owner" };

function realEntries(count = 8) {
  const gateway = createAgentToolGateway({ now, globalStop: () => false, authorization: createAuthorizationEngine({ now }), circuitThreshold: 10_000, maxCallsPerWindow: 10_000 });
  gateway.registerTool({ actor: owner, definition: { toolId: "repo.read", title: "خواندن", summary: "یک فایل را می‌خواند.", riskTier: "read", argumentSchema: { path: { type: "relative-path", required: true } } } });
  gateway.grantAgent({ actor: owner, agentId: "agent-one", toolIds: ["repo.read"], projectIds: ["project-one"] });
  for (let index = 0; index < count; index += 1) gateway.evaluateCall({ agentId: "agent-one", projectId: "project-one", toolId: "repo.read", args: { path: `a/${index}.md` }, observedDefinitionDigest: gateway.toolDigest("repo.read") });
  return gateway.audit();
}
const clone = entries => structuredClone([...entries]);
const head = entries => ({ seq: entries.length, hash: entries.at(-1).hash });

test("an untouched chain is intact against its reference head and has a stable digest", () => {
  const entries = realEntries();
  assert.ok(entries.length >= 8);
  const first = verifyAuditChainDetailed(entries, { expectedHead: head(entries) });
  assert.equal(first.status, "intact");
  assert.equal(first.ok, true);
  assert.equal(first.anchored, true);
  assert.equal(first.failure, null);
  assert.match(first.digest, /^[0-9a-f]{64}$/);
  assert.equal(verifyAuditChainDetailed(clone(entries), { expectedHead: head(entries) }).digest, first.digest, "the digest depends on content, not on object identity");
  const longer = verifyAuditChainDetailed(entries, { expectedHead: { seq: 3, hash: entries[2].hash } });
  assert.equal(longer.status, "intact");
  assert.equal(longer.aheadOfReference, true, "growth beyond the reference is reported, not hidden");
});

test("without a reference head a valid chain is only consistent, never intact", () => {
  const entries = realEntries();
  const result = verifyAuditChainDetailed(entries);
  assert.equal(result.status, "consistent");
  assert.equal(result.ok, false);
  assert.equal(result.anchored, false);
  assert.match(result.reason, /newest entries/);
  const empty = verifyAuditChainDetailed([]);
  assert.equal(empty.status, "consistent");
  assert.equal(empty.headHash, "genesis");
  assert.equal(verifyAuditChainDetailed([], { expectedHead: { seq: 0 } }).status, "intact");
});

test("an unavailable chain is unknown and unknown is never healthy", () => {
  for (const missing of [undefined, null, "chain", 7, {}]) {
    const result = verifyAuditChainDetailed(missing);
    assert.equal(result.status, "unknown");
    assert.equal(result.ok, false);
    assert.equal(result.digest, null);
    assert.equal(auditIntegritySignal(result).healthy, false);
  }
  assert.equal(verifyAuditChainDetailed(realEntries(2), { expectedHead: { seq: -1 } }).status, "unknown");
  assert.equal(verifyAuditChainDetailed(realEntries(2), { expectedHead: { seq: 2, hash: "short" } }).status, "unknown");
  assert.equal(verifyAuditChainDetailed(realEntries(2), { expectedHead: { seq: 1.5, hash: "a".repeat(64) } }).status, "unknown");
});

test("every kind of tampering is rejected with its own code and the first broken link", () => {
  const entries = realEntries();
  const reference = head(entries);
  const check = (label, mutate, kind, seq) => {
    const copy = clone(entries);
    const changed = mutate(copy) ?? copy;
    const result = verifyAuditChainDetailed(changed, { expectedHead: reference });
    assert.equal(result.status, "broken", label);
    assert.equal(result.failure.kind, kind, label);
    assert.equal(result.failure.code, AUDIT_FAILURE_CODES[kind], label);
    if (seq !== undefined) assert.equal(result.failure.seq, seq, `${label}: first broken link`);
    assert.equal(result.ok, false);
    assert.equal(result.digest, null);
    return result;
  };
  check("edit a decision", copy => { copy[2].code = "ALLOWED-FAKE"; }, "edited", 3);
  check("edit the first entry", copy => { copy[0].at = "2020-01-01T00:00:00.000Z"; }, "edited", 1);
  check("edit the newest entry", copy => { copy.at(-1).code = "X"; }, "edited", entries.length);
  check("remove from the middle", copy => copy.filter((_, index) => index !== 3), "removed", 4);
  check("remove the first entry", copy => copy.slice(1), "removed", 1);
  check("swap two neighbours", copy => { [copy[3], copy[4]] = [copy[4], copy[3]]; }, "reordered", 4);
  check("move the last entry up", copy => { const last = copy.pop(); copy.splice(1, 0, last); }, "reordered", 2);
  check("replay an entry", copy => { copy.splice(4, 0, structuredClone(copy[3])); }, "duplicated", 5);
  check("truncate the tail", copy => copy.slice(0, 5), "truncated", 6);
  check("drop everything", () => [], "truncated");
  check("malformed entry", copy => { copy[1] = { seq: 2 }; }, "malformed", 2);
  check("non-object entry", copy => { copy[1] = "entry"; }, "malformed", 2);
  const replaced = clone(entries);
  const forged = { ...replaced[5], code: "FORGED" };
  const { hash: ignored, ...body } = forged;
  assert.ok(ignored);
  check("a forged tail with a different head", copy => { copy[copy.length - 1] = { ...body, hash: "f".repeat(64) }; }, "edited", entries.length);
  const wrongHead = verifyAuditChainDetailed(entries, { expectedHead: { seq: entries.length, hash: "e".repeat(64) } });
  assert.equal(wrongHead.failure.kind, "head-mismatch");
  const foreignReference = verifyAuditChainDetailed(entries, { expectedHead: { seq: 2, hash: "d".repeat(64) } });
  assert.equal(foreignReference.failure.kind, "head-mismatch", "a reference link that is not in the chain is a mismatch");
  assert.equal(new Set(Object.values(AUDIT_FAILURE_CODES)).size, Object.keys(AUDIT_FAILURE_CODES).length, "each failure kind has a distinct code");
});

test("truncation is invisible without a reference head and is flagged as unanchored, not intact", () => {
  const entries = realEntries();
  const cut = verifyAuditChainDetailed(entries.slice(0, 5));
  assert.equal(cut.status, "consistent");
  assert.equal(cut.anchored, false);
  assert.notEqual(cut.status, "intact");
});

test("the Delivery Truth field reads unknown unless a verifier reports intact", () => {
  const audit = { audit_id: "a", ranges: [{ from: "BO-001", to: "BO-170", count: 170, status: "verified", work_package: "WP-01" }] };
  const trace = { requirements: [{ id: "R1", status: "implemented", work_package: "WP-01" }] };
  const truth = extra => computeDeliveryTruth({ audit, trace, now, ...extra });
  assert.equal(truth({}).auditIntegrity.status, "unknown");
  assert.equal(truth({}).auditIntegrity.healthy, false);
  assert.equal(truth({ auditChain: { status: "healthy-looking", healthy: true } }).auditIntegrity.status, "unknown", "an invented status is not trusted");
  assert.equal(truth({ auditChain: { status: "intact", healthy: false } }).auditIntegrity.healthy, true, "health follows the status, not a caller flag");
  const entries = realEntries();
  const intact = truth({ auditChain: auditIntegritySignal(verifyAuditChainDetailed(entries, { expectedHead: head(entries) })) });
  assert.equal(intact.auditIntegrity.status, "intact");
  assert.equal(intact.auditIntegrity.healthy, true);
  assert.equal(truth({ auditChain: auditIntegritySignal(verifyAuditChainDetailed(entries)) }).auditIntegrity.healthy, false, "consistent is not intact");
  const damaged = clone(entries);
  damaged[1].code = "X";
  const broken = truth({ auditChain: auditIntegritySignal(verifyAuditChainDetailed(damaged, { expectedHead: head(entries) })) });
  assert.equal(broken.auditIntegrity.status, "broken");
  assert.equal(broken.auditIntegrity.failureCode, "AUDIT_EDITED");
  assert.ok(broken.nextActions.some(item => item.kind === "audit-integrity"));
  assert.equal(truth({}).nextActions.some(item => item.kind === "audit-integrity"), false);
});

test("the pnpm audit:chain command is read-only and reports through exit codes", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "hero-audit-chain-"));
  const capture = () => { const out = []; const err = []; return { out, err, stdout: { write: text => out.push(text) }, stderr: { write: text => err.push(text) } }; };
  try {
    const entries = realEntries();
    const intactFile = path.join(directory, "intact.json");
    fs.writeFileSync(intactFile, JSON.stringify({ entries, head: head(entries) }));
    const before = fs.readFileSync(intactFile, "utf8");
    let io = capture();
    assert.equal(runAuditChainCommand(["--file", intactFile], { stdout: io.stdout, stderr: io.stderr }), 0);
    assert.equal(JSON.parse(io.out.join("")).verification.status, "intact");
    assert.equal(fs.readFileSync(intactFile, "utf8"), before, "the command never modifies the file");

    const damaged = clone(entries);
    damaged[3].code = "X";
    const brokenFile = path.join(directory, "broken.json");
    fs.writeFileSync(brokenFile, JSON.stringify(damaged));
    io = capture();
    assert.equal(runAuditChainCommand(["--file", brokenFile], { stdout: io.stdout, stderr: io.stderr }), 1);
    assert.equal(JSON.parse(io.out.join("")).verification.failure.code, "AUDIT_EDITED");

    io = capture();
    assert.equal(runAuditChainCommand(["--file", brokenFile, "--head-seq", String(entries.length), "--head-hash", entries.at(-1).hash], { stdout: io.stdout, stderr: io.stderr }), 1);

    const plain = path.join(directory, "plain.json");
    fs.writeFileSync(plain, JSON.stringify(entries));
    io = capture();
    assert.equal(runAuditChainCommand(["--file", plain], { stdout: io.stdout, stderr: io.stderr }), 0);
    assert.equal(JSON.parse(io.out.join("")).signal.healthy, false, "a consistent chain without a head is not reported healthy");

    io = capture();
    assert.equal(runAuditChainCommand(["--file", path.join(directory, "missing.json")], { stdout: io.stdout, stderr: io.stderr }), 2);
    assert.equal(JSON.parse(io.out.join("")).status, "unknown");
    io = capture();
    assert.equal(runAuditChainCommand([], { stdout: io.stdout, stderr: io.stderr }), 2);
    const notJson = path.join(directory, "bad.json");
    fs.writeFileSync(notJson, "not json");
    io = capture();
    assert.equal(runAuditChainCommand(["--file", notJson], { stdout: io.stdout, stderr: io.stderr }), 2);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
