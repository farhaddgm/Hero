import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { createHeroServer } from "../apps/control-plane/src/server.mjs";
import {
  CAPABILITY_KEYS,
  MAX_VERIFICATION_AGE_DAYS,
  getModelCapabilitiesSummary,
  isValidCapabilityValue,
  isValidIsoDay,
  validateModelCapabilityRegistry
} from "../packages/contracts/src/model-capabilities.mjs";
import { createHumanIdentity, createTotpCode } from "../packages/domain/src/human-identity.mjs";
import { ModelCapabilityError, TASK_CAPABILITY_NEEDS, adviseTaskGraph, cellStatus, describeModelCapabilities, matchRequirementsToModels } from "../packages/domain/src/model-capability-matrix.mjs";
import { createPlanner } from "../packages/domain/src/planner.mjs";
import { createOwnerAuth } from "../packages/domain/src/owner-auth.mjs";
import { createProjectAccessRegistry } from "../packages/domain/src/project-access.mjs";

const shipped = JSON.parse(fs.readFileSync(new URL("../config/model-capabilities/model-capabilities-v1.json", import.meta.url), "utf8"));
const NOW = "2026-10-21T12:00:00.000Z";
const verified = (value, patch = {}) => ({ value, source: "https://docs.example.test/models", verifiedAt: "2026-10-01", verifiedBy: "hero-owner", ...patch });
const entry = (modelId, capabilities = {}, extra = {}) => ({ providerId: "openai", modelId, capabilities: { contextWindowTokens: { value: "unknown" }, toolUse: { value: "unknown" }, structuredOutput: { value: "unknown" }, dataResidency: { value: "unknown" }, ...capabilities }, ...extra });
const registryOf = (...entries) => ({ schema: "hero.model-capabilities/v1", version: "1.0.0", entries });

test("the shipped matrix is valid in strict mode and every value in it is explicitly unknown", () => {
  assert.deepEqual(validateModelCapabilityRegistry(shipped, { strict: true }), []);
  assert.ok(shipped.entries.length >= 2);
  for (const item of shipped.entries) {
    assert.equal(item.alias, true, "the shipped names are role families, not official model ids");
    for (const key of CAPABILITY_KEYS) assert.deepEqual(item.capabilities[key], { value: "unknown" }, `${item.modelId}.${key}`);
  }
  assert.equal(getModelCapabilitiesSummary().rules.length, 4);
});

test("strict validation refuses a guessed value: a known value must carry source, day and verifier", () => {
  const guessed = registryOf(entry("m1", { toolUse: { value: true } }));
  assert.deepEqual(validateModelCapabilityRegistry(guessed), [], "non-strict loading allows it");
  const strict = validateModelCapabilityRegistry(guessed, { strict: true });
  assert.equal(strict.length, 3);
  assert.ok(strict.every(item => /a guessed value cannot be committed/.test(item)));
  assert.deepEqual(validateModelCapabilityRegistry(registryOf(entry("m1", { toolUse: verified(true) })), { strict: true }), []);
});

test("registry validation catches duplicates, unknown providers and capabilities, malformed values and fake verification on unknowns", () => {
  const errors = (registry, options) => validateModelCapabilityRegistry(registry, options);
  assert.ok(errors(registryOf(entry("m1"), entry("m1"))).some(item => /duplicate/.test(item)));
  assert.ok(errors(registryOf({ ...entry("m1"), providerId: "mystery" })).some(item => /not a known provider/.test(item)));
  assert.ok(errors(registryOf(entry("bad id!"))).some(item => /modelId is invalid/.test(item)));
  assert.ok(errors(registryOf({ ...entry("m1"), capabilities: { ...entry("m1").capabilities, telepathy: { value: true } } })).some(item => /unknown capability/.test(item)));
  assert.ok(errors(registryOf({ ...entry("m1"), capabilities: { toolUse: { value: "unknown" } } })).some(item => /must be stated, even as unknown/.test(item)));
  assert.ok(errors(registryOf(entry("m1", { contextWindowTokens: { value: -5 } }))).some(item => /value is invalid/.test(item)));
  assert.ok(errors(registryOf(entry("m1", { toolUse: { value: "yes" } }))).some(item => /value is invalid/.test(item)));
  assert.ok(errors(registryOf(entry("m1", { dataResidency: { value: [] } }))).some(item => /value is invalid/.test(item)));
  assert.ok(errors(registryOf(entry("m1", { dataResidency: { value: ["eu", "eu"] } }))).some(item => /value is invalid/.test(item)));
  assert.ok(errors(registryOf(entry("m1", { toolUse: { value: "unknown", verifiedAt: "2026-10-01" } }))).some(item => /unknown value must not claim verifiedAt/.test(item)));
  assert.ok(errors(registryOf(entry("m1", { toolUse: verified(true, { source: "http://insecure.example.test" }) }))).some(item => /source must be an https URL/.test(item)));
  assert.ok(errors(registryOf(entry("m1", { toolUse: verified(true, { source: "https://user:pass@docs.example.test" }) }))).some(item => /source must be an https URL/.test(item)));
  assert.ok(errors(registryOf(entry("m1", { toolUse: verified(true, { verifiedAt: "2026-02-30" }) }))).some(item => /verifiedAt must be/.test(item)));
  assert.ok(errors(registryOf(entry("m1", { toolUse: verified(true, { verifiedBy: "x" }) }))).some(item => /verifiedBy is invalid/.test(item)));
  assert.deepEqual(errors({ schema: "x" }), ["unexpected model capability registry schema"]);
  assert.ok(errors({ schema: "hero.model-capabilities/v1", version: "1.0.0", entries: "x" }).some(item => /entries must be an array/.test(item)));
  assert.equal(isValidIsoDay("2026-02-29"), false);
  assert.equal(isValidIsoDay("2024-02-29"), true);
  assert.equal(isValidCapabilityValue("toolUse", false), true);
  assert.equal(isValidCapabilityValue("nonsense", true), false);
});

test("a cell is verified only with full evidence inside the age limit; everything else cannot confirm", () => {
  const status = (cell, key = "toolUse", now = NOW) => cellStatus(cell, key, now).status;
  assert.equal(status({ value: "unknown" }), "unknown");
  assert.equal(status(undefined), "unknown");
  assert.equal(status(verified(true)), "verified");
  assert.equal(status(verified(true, { verifiedAt: undefined })), "unverified", "no verification day");
  assert.equal(status(verified(true, { source: undefined })), "unverified");
  assert.equal(status(verified(true, { verifiedBy: undefined })), "unverified");
  assert.equal(status(verified(true, { verifiedAt: "2026-10-22" })), "unverified", "a verification day in the future is not evidence");
  assert.equal(status(verified("yes")), "unverified");
  assert.equal(cellStatus(verified(true, { verifiedAt: "2026-07-23" }), "toolUse", NOW).ageDays, MAX_VERIFICATION_AGE_DAYS);
  assert.equal(status(verified(true, { verifiedAt: "2026-07-23" })), "verified", "exactly at the limit is still fresh");
  assert.equal(status(verified(true, { verifiedAt: "2026-07-22" })), "stale", "one day over the limit is stale");
  assert.throws(() => cellStatus(verified(true), "toolUse", "not a time"), ModelCapabilityError);
});

test("the readable view never exposes an unverified or stale value and never turns unknown into supported", () => {
  const registry = registryOf(
    entry("fresh", { toolUse: verified(true), contextWindowTokens: verified(200000), dataResidency: verified(["eu"]) }),
    entry("old", { toolUse: verified(true, { verifiedAt: "2026-01-01" }) }),
    entry("noday", { toolUse: { value: true } })
  );
  const view = describeModelCapabilities(registry, { now: NOW });
  const byModel = Object.fromEntries(view.entries.map(item => [item.modelId, item]));
  assert.equal(byModel.fresh.capabilities.toolUse.value, true);
  assert.equal(byModel.fresh.capabilities.toolUse.status, "verified");
  assert.equal(byModel.fresh.capabilities.toolUse.source, "https://docs.example.test/models");
  assert.deepEqual(byModel.fresh.capabilities.dataResidency.value, ["eu"]);
  for (const model of ["old", "noday"]) {
    assert.equal(byModel[model].capabilities.toolUse.value, "unknown", `${model}: hidden`);
    assert.notEqual(byModel[model].capabilities.toolUse.status, "verified");
  }
  assert.equal(byModel.old.capabilities.toolUse.status, "stale");
  assert.equal(byModel.noday.capabilities.toolUse.status, "unverified");
  assert.equal(byModel.fresh.capabilities.structuredOutput.value, "unknown");
  assert.deepEqual({ ...view.cellCounts }, { unknown: 7, unverified: 1, stale: 1, verified: 3 });
  assert.equal(Object.values(view.cellCounts).reduce((sum, value) => sum + value, 0), 12);
  assert.deepEqual(view.entries.map(item => item.modelId), ["fresh", "noday", "old"], "sorted deterministically");
  assert.match(view.boundary, /never selects/);
  assert.throws(() => describeModelCapabilities({ schema: "bad" }, { now: NOW }), error => error.code === "REGISTRY_INVALID");
});

test("matching: unknown never meets; a confirmed failure beats an unknown; stale and unverified cannot confirm", () => {
  const registry = registryOf(
    entry("allgood", { toolUse: verified(true), structuredOutput: verified(true), contextWindowTokens: verified(128000), dataResidency: verified(["eu"]) }),
    entry("notools", { toolUse: verified(false), structuredOutput: verified(true) }),
    entry("silent"),
    entry("stale", { toolUse: verified(true, { verifiedAt: "2026-01-01" }), structuredOutput: verified(true) }),
    entry("small", { contextWindowTokens: verified(8000), toolUse: verified(true) })
  );
  const match = requirements => Object.fromEntries(matchRequirementsToModels({ requirements, registry, now: NOW }).models.map(item => [item.modelId, item.fit]));
  assert.deepEqual(match({ toolUse: true, structuredOutput: true }), { allgood: "meets", notools: "does-not-meet", silent: "cannot-confirm", small: "cannot-confirm", stale: "cannot-confirm" });
  assert.deepEqual(match({ contextWindowTokens: 100000 }), { allgood: "meets", notools: "cannot-confirm", silent: "cannot-confirm", small: "does-not-meet", stale: "cannot-confirm" });
  assert.deepEqual(match({ dataResidency: ["eu", "uk"] }), { allgood: "meets", notools: "cannot-confirm", silent: "cannot-confirm", small: "cannot-confirm", stale: "cannot-confirm" });
  assert.equal(match({ dataResidency: ["us"] }).allgood, "does-not-meet", "a model that processes data outside the allowed regions fails");
  assert.equal(match({ toolUse: true, contextWindowTokens: 100000 }).small, "does-not-meet", "one confirmed failure decides even though other cells are unknown");
  const result = matchRequirementsToModels({ requirements: { toolUse: true }, registry, now: NOW });
  assert.equal(result.advisory, true);
  assert.equal(result.decision, null);
  assert.deepEqual({ ...result.counts }, { meets: 2, doesNotMeet: 1, cannotConfirm: 2 });
  assert.deepEqual(result.models.map(item => item.modelId), ["allgood", "notools", "silent", "small", "stale"], "stable order");
  const empty = matchRequirementsToModels({ requirements: {}, registry, now: NOW });
  assert.ok(empty.models.every(item => item.fit === "meets"), "an empty requirement is trivially met");
  const shippedMatch = matchRequirementsToModels({ requirements: { toolUse: true, structuredOutput: true }, registry: shipped, now: NOW });
  assert.equal(shippedMatch.counts.meets, 0, "with every value unknown, no shipped model can be confirmed");
  assert.ok(shippedMatch.models.every(item => item.fit === "cannot-confirm"));
});

test("requirement input is validated", () => {
  const registry = registryOf(entry("m1"));
  const code = requirements => { try { matchRequirementsToModels({ requirements, registry, now: NOW }); return null; } catch (error) { return error.code; } };
  assert.equal(code(null), "INVALID_REQUIREMENTS");
  assert.equal(code([]), "INVALID_REQUIREMENTS");
  assert.equal(code({ telepathy: true }), "INVALID_REQUIREMENTS");
  assert.equal(code({ toolUse: false }), "INVALID_REQUIREMENTS");
  assert.equal(code({ contextWindowTokens: 0 }), "INVALID_REQUIREMENTS");
  assert.equal(code({ dataResidency: [] }), "INVALID_REQUIREMENTS");
  assert.equal(code({ toolUse: true }), null);
});

test("task kinds map to declared needs and the advice never excludes a model it cannot confirm", () => {
  const graph = { nodes: [{ taskId: "T-1", kind: "implementation" }, { taskId: "T-2", kind: "handoff" }, { taskId: "T-3", kind: "mystery-kind" }] };
  const registry = registryOf(entry("capable", { toolUse: verified(true), structuredOutput: verified(true) }), entry("silent"));
  const advice = adviseTaskGraph({ graph, registry, now: NOW });
  assert.equal(advice.advisory, true);
  assert.equal(advice.decision, null);
  assert.deepEqual(advice.tasks[0].meets, ["openai/capable"]);
  assert.deepEqual({ ...advice.tasks[0].counts }, { meets: 1, doesNotMeet: 0, cannotConfirm: 1 });
  assert.deepEqual(advice.tasks[1].meets, ["openai/capable", "openai/silent"], "a task with no needs is met by everything");
  assert.equal(advice.tasks[2].requirements, null);
  assert.match(advice.note, /unknown, not no/);
  assert.deepEqual(Object.keys(TASK_CAPABILITY_NEEDS).sort(), ["analysis", "architecture", "handoff", "implementation", "review", "testing"]);
  assert.deepEqual(adviseTaskGraph({ graph: null, registry, now: NOW }).tasks, []);
});

test("the Planner receives one advisory field and its decisions and graph do not change", () => {
  const request = { planningId: "PLAN-NX030", requestId: "REQ-NX030", projectId: "HERO", documentVersion: "v1.0", requestText: "Build a small web dashboard for the owner with a login page.", idempotencyKey: "plan-nx030-once", actor: { kind: "orchestrator", id: "hero-control-plane" } };
  const clock = () => NOW;
  const without = createPlanner({ now: clock }).plan(request);
  const registry = registryOf(entry("capable", { toolUse: verified(true), structuredOutput: verified(true) }), entry("silent"));
  const withAdvice = createPlanner({ now: clock, modelCapabilityRegistry: registry }).plan(request);
  assert.equal(without.modelCapabilityAdvice, undefined, "no registry, no field");
  assert.ok(withAdvice.modelCapabilityAdvice.tasks.length > 0);
  const strip = plan => { const { modelCapabilityAdvice, eventId, version, ...rest } = plan; return rest; };
  assert.deepEqual(strip(withAdvice), strip(without), "graph, readiness, output advisory and dispatch are unchanged");
  assert.equal(withAdvice.dispatch.status, without.dispatch.status);
  const implementation = withAdvice.modelCapabilityAdvice.tasks.find(item => item.kind === "implementation");
  assert.deepEqual(implementation.meets, ["openai/capable"]);
});

test("GET /api/model-capabilities is read-only, follows the same scope rule as other global routes and reports unknown honestly", async t => {
  const secret = "owner-mfa-secret-for-capabilities";
  const clockNow = () => NOW;
  const access = createProjectAccessRegistry({ ownerUserId: "hero-owner", ownerUser: { email: "owner@example.test", displayName: "Owner" }, now: clockNow });
  const identity = createHumanIdentity({ accessRegistry: access, sessionSecret: "capabilities-session-secret-12345678901234567", now: clockNow, owner: { userId: "hero-owner", email: "owner@example.test", displayName: "Owner", password: "Owner password 123", mfaSecret: secret } });
  const login = identity.completeLogin({ challengeId: identity.beginLogin({ email: "owner@example.test", password: "Owner password 123" }).challengeId, mfaCode: createTotpCode(secret, Math.floor(Date.parse(NOW) / 1000)) });
  const app = createHeroServer({ host: "127.0.0.1", port: 0, now: clockNow, projectAccessRegistry: access, humanIdentity: identity, ownerAuth: createOwnerAuth({ secret: "capabilities-owner-auth-secret-123456789012" }) });
  const address = await app.start();
  t.after(() => app.stop());
  const base = `http://127.0.0.1:${address.port}`;
  const signedIn = { authorization: `Bearer ${login.token}`, origin: base };
  const anonymous = await fetch(`${base}/api/model-capabilities`);
  assert.equal(anonymous.status, 401);
  await anonymous.arrayBuffer();
  const unscoped = await fetch(`${base}/api/model-capabilities`, { headers: signedIn });
  assert.equal(unscoped.status, 403, "like /api/delivery-truth, a human session names a project");
  await unscoped.arrayBuffer();
  const scoped = await fetch(`${base}/api/model-capabilities?projectId=capability-demo`, { headers: signedIn });
  assert.equal(scoped.status, 200);
  const body = await scoped.json();
  assert.equal(body.modelCapabilities.entryCount, shipped.entries.length);
  assert.equal(body.modelCapabilities.cellCounts.unknown, shipped.entries.length * 4);
  assert.equal(body.modelCapabilities.cellCounts.verified, 0);
  assert.ok(body.modelCapabilities.entries.every(item => Object.values(item.capabilities).every(cell => cell.value === "unknown" && cell.status === "unknown")));
  const write = await fetch(`${base}/api/model-capabilities?projectId=capability-demo`, { method: "POST", headers: { ...signedIn, "content-type": "application/json" }, body: "{}" });
  assert.ok(write.status >= 400, `a write answered ${write.status}`);
  await write.arrayBuffer();
});
