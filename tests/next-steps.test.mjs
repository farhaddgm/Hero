import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { REPO_ROOT } from "../tools/fs-policy.mjs";
import { validateNextSteps } from "../tools/check-next-steps.mjs";

const registryPath = path.join(REPO_ROOT, "config", "product-development", "next-50-steps-v1.json");
const loadRegistry = () => JSON.parse(fs.readFileSync(registryPath, "utf8"));

function mutated(change) {
  const registry = structuredClone(loadRegistry());
  change(registry);
  return validateNextSteps({ registry });
}

const codesOf = report => new Set(report.errors.map(error => error.code));
const stepOf = (registry, id) => registry.steps.find(step => step.id === id);

test("the committed NX-001..NX-050 registry, track cards and roadmap table agree", () => {
  const report = validateNextSteps();
  assert.deepEqual(report.errors, []);
  assert.equal(report.steps, 50);
  assert.equal(report.tracks, 5);
});

test("the plan is a complete, contiguous set of ids with ten steps per track", () => {
  const registry = loadRegistry();
  assert.equal(registry.expected_total, 50);
  assert.deepEqual(registry.steps.map(step => step.id), Array.from({ length: 50 }, (_, index) => `NX-${String(index + 1).padStart(3, "0")}`));
  for (const track of registry.tracks) {
    assert.equal(registry.steps.filter(step => step.track === track.key).length, 10, `track ${track.key}`);
  }
});

test("a deleted step is rejected: a step may only be dropped, never removed", () => {
  const report = mutated(registry => registry.steps.splice(10, 1));
  const codes = codesOf(report);
  assert.ok(codes.has("STEP_COUNT_MISMATCH"));
  assert.ok(codes.has("NON_CONTIGUOUS_STEP_ID"));
});

test("duplicate ids and invalid enumerations are rejected", () => {
  assert.ok(codesOf(mutated(registry => { stepOf(registry, "NX-005").id = "NX-004"; })).has("DUPLICATE_STEP_ID"));
  assert.ok(codesOf(mutated(registry => { stepOf(registry, "NX-005").gate = "live"; })).has("INVALID_GATE"));
  assert.ok(codesOf(mutated(registry => { stepOf(registry, "NX-005").priority = "P9"; })).has("INVALID_PRIORITY"));
  assert.ok(codesOf(mutated(registry => { stepOf(registry, "NX-005").wave = 7; })).has("INVALID_WAVE"));
  assert.ok(codesOf(mutated(registry => { stepOf(registry, "NX-005").status = "done"; })).has("INVALID_STATUS"));
});

test("dependencies must exist, avoid cycles and come from an earlier wave", () => {
  assert.ok(codesOf(mutated(registry => { stepOf(registry, "NX-003").depends_on = ["NX-099"]; })).has("UNKNOWN_DEPENDENCY"));
  assert.ok(codesOf(mutated(registry => { stepOf(registry, "NX-003").depends_on = ["NX-003"]; })).has("SELF_DEPENDENCY"));
  assert.ok(codesOf(mutated(registry => { stepOf(registry, "NX-003").depends_on = ["not-a-step"]; })).has("INVALID_DEPENDENCY_REFERENCE"));

  const sameWave = codesOf(mutated(registry => { stepOf(registry, "NX-003").depends_on = ["NX-002"]; }));
  assert.ok(sameWave.has("WAVE_ORDER_VIOLATION"));

  const cycle = codesOf(mutated(registry => {
    stepOf(registry, "NX-004").depends_on = ["NX-003"];
    stepOf(registry, "NX-003").depends_on = ["NX-004"];
  }));
  assert.ok(cycle.has("DEPENDENCY_CYCLE"));
});

test("references to AR items, requirements, ADRs and specs must exist in the repository", () => {
  const codes = codesOf(mutated(registry => {
    stepOf(registry, "NX-002").depends_on = ["AR-99", "ADR-9999", "BO-ZZZ-999", "HERO-999"];
  }));
  assert.ok(codes.has("UNKNOWN_AR_REFERENCE"));
  assert.ok(codes.has("UNKNOWN_ADR_REFERENCE"));
  assert.ok(codes.has("UNKNOWN_REQUIREMENT_REFERENCE"));
  assert.ok(codes.has("UNKNOWN_SPEC_REFERENCE"));
});

test("a step cannot claim source_complete or verified without real evidence", () => {
  const noEvidence = codesOf(mutated(registry => { stepOf(registry, "NX-002").status = "source_complete"; }));
  assert.ok(noEvidence.has("STATUS_WITHOUT_EVIDENCE"));

  const missingFile = codesOf(mutated(registry => {
    const step = stepOf(registry, "NX-002");
    step.status = "source_complete";
    step.evidence = ["tools/does-not-exist.mjs"];
  }));
  assert.ok(missingFile.has("INVALID_EVIDENCE_PATH"));

  const traversal = codesOf(mutated(registry => {
    const step = stepOf(registry, "NX-002");
    step.status = "source_complete";
    step.evidence = ["../outside.md"];
  }));
  assert.ok(traversal.has("INVALID_EVIDENCE_PATH"));

  const runtimeNeedsRecord = codesOf(mutated(registry => {
    const step = stepOf(registry, "NX-001");
    step.status = "verified";
    step.evidence = ["tools/check-next-steps.mjs"];
  }));
  assert.ok(runtimeNeedsRecord.has("VERIFIED_WITHOUT_RUNTIME_EVIDENCE"));
});

test("the declared summary must equal the computed summary", () => {
  assert.ok(codesOf(mutated(registry => { registry.summary.total = 51; })).has("SUMMARY_MISMATCH"));
  assert.ok(codesOf(mutated(registry => { registry.summary.by_gate.offline += 1; })).has("SUMMARY_MISMATCH"));
  assert.ok(codesOf(mutated(registry => { registry.summary.by_status.verified = 3; })).has("SUMMARY_MISMATCH"));
});

test("cards and the roadmap table cannot drift from the registry", () => {
  const title = mutated(registry => { stepOf(registry, "NX-021").title = "عنوان دیگر"; });
  assert.ok(codesOf(title).has("CARD_TITLE_MISMATCH"));
  assert.ok(codesOf(title).has("ROADMAP_TABLE_MISMATCH"));

  assert.ok(codesOf(mutated(registry => { stepOf(registry, "NX-021").size = "L"; })).has("CARD_FIELD_MISMATCH"));
  assert.ok(codesOf(mutated(registry => { stepOf(registry, "NX-021").depends_on = ["AR-01"]; })).has("CARD_DEPENDENCY_MISMATCH"));
  assert.ok(codesOf(mutated(registry => { stepOf(registry, "NX-021").needs_owner_input = true; })).has("CARD_OWNER_INPUT_MISMATCH"));
  assert.ok(codesOf(mutated(registry => { stepOf(registry, "NX-021").track = "E"; })).has("MISSING_CARD"));
});

test("plan status approved requires the documents to be active", () => {
  const codes = codesOf(mutated(registry => { registry.status = "approved"; }));
  assert.ok(codes.has("ROADMAP_STATUS_MISMATCH"));
  assert.ok(codes.has("TRACK_DOCUMENT_STATUS_MISMATCH"));
});
