import assert from "node:assert/strict";
import test from "node:test";

import { AUTOMATION_MODES, POLICY_RISK_LEVELS, REQUIRED_POLICY_PATHS, getProjectSettingsContractSummary, policyPackTemplate, validateProjectSettingsContract, validateSettingValue } from "../packages/contracts/src/project-settings.mjs";
import { PRODUCT_TYPES } from "../packages/contracts/src/product-factory.mjs";
import { createProjectSettingsRegistry, ProjectSettingsError } from "../packages/domain/src/project-settings.mjs";
import { createProjectWorkspace } from "../packages/domain/src/project-workspace.mjs";
import { createHeroServer } from "../apps/control-plane/src/server.mjs";
import { createHumanIdentity, createTotpCode } from "../packages/domain/src/human-identity.mjs";
import { createProjectAccessRegistry } from "../packages/domain/src/project-access.mjs";

const now = () => "2026-10-05T09:00:00.000Z";
const owner = { subject: "hero-owner", role: "project-owner" };
const admin = { subject: "project-admin", role: "admin" };
const code = expected => error => error instanceof ProjectSettingsError && error.code === expected;

function withPack(projectId, { projectType = "application", riskLevel = "standard" } = {}, settings = createProjectSettingsRegistry({ now })) {
  settings.suggestPolicyPack({ projectId, projectType, riskLevel });
  settings.applyPolicyPack({ actor: owner, projectId, reason: "Initial policy" });
  return settings;
}

// Store-shaped rows, exactly as postgresql-project-workspace-store.listSettings returns them:
// no lifecycle state column, so the domain must derive it.
function persistedRows(settings, projectId, paths) {
  return paths.flatMap(path => settings.history({ projectId, path })).map(item => ({ projectId: item.projectId, path: item.path, layer: item.layer, runId: item.runId ?? null, version: item.version, value: item.value, actor: item.actor, reason: item.reason, impact: item.impact, rollbackReference: item.rollbackReference ?? null, source: item.source, recordedAt: item.recordedAt }));
}

test("BO-043 typed schema rejects wrong value types and keeps free paths as safe JSON", () => {
  assert.deepEqual(validateProjectSettingsContract(), []);
  const settings = withPack("project-a");
  assert.throws(() => settings.setValue({ actor: admin, projectId: "project-a", path: "budget.tokenHardCap", value: "a lot", reason: "typo" }), code("SETTING_SCHEMA_VIOLATION"));
  assert.throws(() => settings.setValue({ actor: admin, projectId: "project-a", path: "budget.tokenHardCap", value: 12.5, reason: "fraction" }), code("SETTING_SCHEMA_VIOLATION"));
  assert.throws(() => settings.setValue({ actor: admin, projectId: "project-a", path: "automation.mode", value: "yolo", reason: "unknown mode" }), code("SETTING_SCHEMA_VIOLATION"));
  assert.throws(() => settings.setValue({ actor: admin, projectId: "project-a", path: "ai.roleModels.developer", value: "Bad Model!", reason: "bad id" }), code("SETTING_SCHEMA_VIOLATION"));
  assert.equal(settings.setValue({ actor: admin, projectId: "project-a", path: "delivery.preferredWindow", value: { day: "sat" }, reason: "free path" }).version, 1);
  assert.throws(() => settings.setValue({ actor: admin, projectId: "project-a", path: "delivery.notes", value: { apiKey: "x" }, reason: "sensitive" }), code("SENSITIVE_SETTING_FORBIDDEN"));
  const summary = getProjectSettingsContractSummary();
  assert.deepEqual(summary.requiredPolicyPaths, REQUIRED_POLICY_PATHS);
  assert.equal(summary.templates.length, PRODUCT_TYPES.length * POLICY_RISK_LEVELS.length);
});

test("BO-044 and Exit Gate: a Role uses a different model in project A than in project B with explainable provenance", () => {
  const settings = withPack("project-a");
  withPack("project-b", { riskLevel: "high" }, settings);
  settings.setValue({ actor: admin, projectId: "project-a", path: "ai.roleModels.developer", value: "terra", reason: "Fast iteration for developer role" });
  settings.setValue({ actor: admin, projectId: "project-b", path: "ai.roleModels.developer", value: "sol", reason: "Deep reasoning for high risk" });
  settings.setValue({ actor: admin, projectId: "project-b", path: "ai.roleModels.developer", layer: "run-override", runId: "run-b-7", value: "luna", reason: "One cheap exploratory Run" });
  assert.equal(settings.effective({ projectId: "project-a", path: "ai.roleModels.developer" }).value, "terra");
  assert.equal(settings.effective({ projectId: "project-b", path: "ai.roleModels.developer" }).value, "sol");
  assert.equal(settings.effective({ projectId: "project-b", path: "ai.roleModels.developer", runId: "run-b-7" }).value, "luna");
  const explained = settings.explain({ projectId: "project-b", path: "ai.roleModels.developer", runId: "run-b-7" });
  assert.equal(explained.status, "resolved");
  assert.deepEqual(explained.chain.map(link => [link.layer, link.status]), [["run-override", "winner"], ["project-override", "shadowed"], ["policy-template", "absent"], ["hero-invariant", "absent"]]);
  assert.equal(explained.chain[0].actor, "project-admin");
  assert.equal(explained.chain[1].reason, "Deep reasoning for high risk");
  const isolation = settings.explain({ projectId: "project-a", path: "security.projectIsolation" });
  assert.equal(isolation.chain.at(-1).status, "winner");
  assert.equal(settings.explain({ projectId: "project-a", path: "ai.roleModels.tester" }).status, "missing");
});

test("BO-045 and BO-047 every command records version, diff, actor, reason, impact, supersede and rollback reference", () => {
  const settings = withPack("project-a");
  const first = settings.setValue({ actor: admin, projectId: "project-a", path: "ai.defaultModel", value: "sol", expectedVersion: 0, reason: "Reasoning first", impact: "higher cost" });
  assert.deepEqual(first.diff, { kind: "added", before: null, after: "sol" });
  const second = settings.setValue({ actor: owner, projectId: "project-a", path: "ai.defaultModel", value: "terra", expectedVersion: first.version, reason: "Balance", impact: "lower cost" });
  assert.equal(second.supersedesVersion, first.version);
  assert.deepEqual(second.diff, { kind: "changed", before: "sol", after: "terra" });
  assert.throws(() => settings.setValue({ actor: owner, projectId: "project-a", path: "ai.defaultModel", value: "luna", expectedVersion: first.version, reason: "stale tab" }), code("STALE_SETTINGS_VERSION"));
  const removed = settings.removeOverride({ actor: owner, projectId: "project-a", path: "ai.defaultModel", expectedVersion: second.version, reason: "Back to template" });
  assert.deepEqual(removed.diff, { kind: "removed", before: "terra", after: null });
  assert.equal(settings.effective({ projectId: "project-a", path: "ai.defaultModel" }).layer, "policy-template");
  assert.throws(() => settings.removeOverride({ actor: owner, projectId: "project-a", path: "ai.defaultModel", expectedVersion: removed.version, reason: "twice" }), code("SETTING_NOT_FOUND"));
  assert.throws(() => settings.removeOverride({ actor: owner, projectId: "project-a", path: "ai.defaultModel", layer: "policy-template", expectedVersion: 1, reason: "template" }), code("OVERRIDE_LAYER_REQUIRED"));
  assert.throws(() => settings.rollback({ actor: owner, projectId: "project-a", path: "ai.defaultModel", toVersion: removed.version, reason: "bad target" }), code("ROLLBACK_TARGET_INVALID"));
  const rolled = settings.rollback({ actor: owner, projectId: "project-a", path: "ai.defaultModel", toVersion: first.version, reason: "Restore reasoning" });
  assert.equal(rolled.rollbackReference, `settings:project-a:ai.defaultModel:${first.version}`);
  assert.equal(settings.effective({ projectId: "project-a", path: "ai.defaultModel" }).value, "sol");
  const log = settings.changeLog({ projectId: "project-a", path: "ai.defaultModel" });
  assert.deepEqual(log.map(entry => entry.diff.kind), ["added", "added", "changed", "removed", "added"]);
  assert.ok(log.every(entry => entry.actor && entry.reason && entry.impact));
  assert.equal(log.at(-1).rollbackReference, rolled.rollbackReference);
});

test("BO-048 templates differ by risk and project type and are deterministic", () => {
  assert.notDeepEqual(policyPackTemplate({ riskLevel: "low" }).values, policyPackTemplate({ riskLevel: "standard" }).values);
  const high = policyPackTemplate({ riskLevel: "high" });
  assert.deepEqual(high.guardedPaths, ["automation.mode", "budget.tokenHardCap"]);
  const security = policyPackTemplate({ projectType: "security-tool", riskLevel: "low" });
  assert.equal(security.values["automation.mode"], "approval-required");
  assert.deepEqual(security.guardedPaths, ["automation.mode"]);
  assert.equal(policyPackTemplate({ projectType: "data", riskLevel: "high" }).values["budget.tokenHardCap"], 100000, "type adjustment never relaxes a stricter risk value");
  assert.equal(policyPackTemplate({ projectType: "data", riskLevel: "low" }).values["budget.tokenHardCap"], 150000);
  assert.deepEqual(policyPackTemplate({ projectType: "web", riskLevel: "standard" }), policyPackTemplate({ projectType: "web", riskLevel: "standard" }));
  assert.throws(() => policyPackTemplate({ projectType: "spaceship" }), TypeError);
  for (const projectType of PRODUCT_TYPES) for (const riskLevel of POLICY_RISK_LEVELS) {
    for (const [path, value] of Object.entries(policyPackTemplate({ projectType, riskLevel }).values)) assert.equal(validateSettingValue(path, value), null, `${projectType}/${riskLevel} ${path}`);
  }
});

test("BO-049 Intake suggests the type- and risk-specific Policy Pack before Foundation approval", () => {
  const settings = createProjectSettingsRegistry({ now });
  const workspace = createProjectWorkspace({ ownerUserId: "hero-owner", now, settings });
  workspace.createProject({ actor: owner, projectId: "project-guard", name: "Guard", intake: { goal: "Inspect hosts", projectType: "security-tool" } });
  const pack = settings.policyPack("project-guard");
  assert.equal(pack.state, "suggested");
  assert.match(pack.templateId, /^policy-template:security-tool:/);
  assert.ok(pack.guardedPaths.includes("automation.mode"));
  assert.equal(pack.values["automation.mode"], "approval-required");
  assert.equal(settings.readiness({ projectId: "project-guard" }).ready, false, "a suggestion is not yet policy");
});

test("BO-050 floors, invariants and missing policy fail closed on write, rollback, hydration and dispatch", () => {
  const settings = withPack("project-h", { riskLevel: "high" });
  assert.throws(() => settings.setValue({ actor: admin, projectId: "project-h", path: "automation.mode", value: "propose-first", reason: "go faster" }), code("POLICY_FLOOR_VIOLATION"));
  assert.throws(() => settings.setValue({ actor: admin, projectId: "project-h", path: "budget.tokenHardCap", layer: "run-override", runId: "run-1", value: 400000, reason: "bigger run" }), code("POLICY_FLOOR_VIOLATION"));
  assert.equal(settings.setValue({ actor: admin, projectId: "project-h", path: "budget.tokenHardCap", value: 50000, reason: "tighter" }).value, 50000);
  assert.equal(settings.setValue({ actor: admin, projectId: "project-h", path: "automation.mode", value: "manual", reason: "tighter" }).value, "manual");
  assert.throws(() => settings.setValue({ actor: owner, projectId: "project-h", path: "automation.mode", layer: "policy-template", value: "propose-first", reason: "lower the floor" }), code("TEMPLATE_WRITE_FORBIDDEN"));
  assert.throws(() => settings.setValue({ actor: owner, projectId: "project-h", path: "security.auditRetention", value: "optional", reason: "weaken" }), code("INVARIANT_WEAKENING_FORBIDDEN"));
  assert.equal(settings.assertDispatchable({ projectId: "project-h" }).ready, true);

  // A tampered or legacy row that relaxes a floor is served as a conflict, never as a value.
  const restarted = createProjectSettingsRegistry({ now });
  for (const row of persistedRows(settings, "project-h", ["automation.mode", "budget.tokenHardCap", "ai.defaultModel", "project.type", "project.riskLevel"])) restarted.hydrateRecord(row);
  restarted.hydrateRecord({ projectId: "project-h", path: "automation.mode", layer: "project-override", runId: null, version: 99, value: "propose-first", actor: "intruder", reason: "tamper", impact: "none", source: "project-override" });
  assert.throws(() => restarted.effective({ projectId: "project-h", path: "automation.mode" }), code("POLICY_CONFLICT"));
  assert.equal(restarted.explain({ projectId: "project-h", path: "automation.mode" }).status, "conflict");
  assert.deepEqual(restarted.readiness({ projectId: "project-h" }).conflicts, [{ path: "automation.mode", code: "POLICY_CONFLICT" }]);
  assert.throws(() => restarted.assertDispatchable({ projectId: "project-h" }), error => code("POLICY_INCOMPLETE")(error) && error.details.conflicts.length === 1);
  restarted.hydrateRecord({ projectId: "project-h", path: "budget.tokenHardCap", layer: "project-override", runId: null, version: 98, value: "unbounded", actor: "intruder", reason: "tamper", impact: "none", source: "project-override" });
  assert.throws(() => restarted.effective({ projectId: "project-h", path: "budget.tokenHardCap" }), code("SETTING_SCHEMA_CONFLICT"));
  assert.ok(restarted.explainProject({ projectId: "project-h" }).length >= 5, "one bad field does not hide the others");

  const empty = createProjectSettingsRegistry({ now });
  empty.setValue({ actor: admin, projectId: "project-e", path: "ai.defaultModel", value: "luna", reason: "only a model" });
  assert.deepEqual(empty.readiness({ projectId: "project-e" }).missing, ["automation.mode", "budget.tokenHardCap"]);
  assert.throws(() => empty.assertDispatchable({ projectId: "project-e" }), code("POLICY_INCOMPLETE"));
});

test("persisted removal survives restart: a removed override never comes back after hydration", () => {
  const settings = withPack("project-r");
  const override = settings.setValue({ actor: admin, projectId: "project-r", path: "ai.defaultModel", value: "sol", reason: "try sol" });
  settings.removeOverride({ actor: admin, projectId: "project-r", path: "ai.defaultModel", expectedVersion: override.version, reason: "back to template" });
  const rows = persistedRows(settings, "project-r", ["ai.defaultModel", "automation.mode", "budget.tokenHardCap", "project.type", "project.riskLevel"]);
  for (const legacyState of [undefined, "active"]) {
    const restarted = createProjectSettingsRegistry({ now });
    for (const row of rows) restarted.hydrateRecord(legacyState ? { ...row, state: legacyState } : row);
    assert.equal(restarted.effective({ projectId: "project-r", path: "ai.defaultModel" }).value, "luna", `state=${legacyState}`);
    assert.equal(restarted.effective({ projectId: "project-r", path: "ai.defaultModel" }).layer, "policy-template");
    assert.deepEqual(restarted.changeLog({ projectId: "project-r", path: "ai.defaultModel" }).map(entry => entry.diff.kind), settings.changeLog({ projectId: "project-r", path: "ai.defaultModel" }).map(entry => entry.diff.kind));
  }
  const outOfOrder = createProjectSettingsRegistry({ now });
  for (const row of [...rows].reverse()) outOfOrder.hydrateRecord(row);
  assert.equal(outOfOrder.effective({ projectId: "project-r", path: "ai.defaultModel" }).layer, "policy-template", "hydration order does not change the winner");
});

// Small deterministic PRNG so a failing seed is reproducible.
function mulberry32(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

test("BO-052 property: random command sequences keep precedence, inheritance, rollback, staleness and invariants exact", () => {
  const PROJECTS = { "proj-std": "standard", "proj-high": "high" };
  const PATHS = { "ai.defaultModel": ["luna", "sol", "terra"], "ai.roleModels.developer": ["luna", "sol", "terra"], "budget.tokenHardCap": [50000, 100000, 150000, 250000, 900000], "automation.mode": AUTOMATION_MODES };
  const RUNS = ["run-a", "run-b"];
  for (const seed of [1, 7, 42, 2026, 31337]) {
    const random = mulberry32(seed); const pick = list => list[Math.floor(random() * list.length)];
    const settings = createProjectSettingsRegistry({ now });
    const model = new Map(); const versions = new Map(); const historyOf = new Map();
    const scopeKey = (p, path, layer, run) => `${p}|${path}|${layer}|${run ?? "-"}`;
    const record = (p, path, layer, run, value, active) => {
      const hk = `${p}|${path}`; const version = (versions.get(hk) ?? 0) + 1; versions.set(hk, version);
      model.set(scopeKey(p, path, layer, run), { value, version, active });
      historyOf.set(hk, [...(historyOf.get(hk) ?? []), { version, layer, run, value, removal: !active }]);
    };
    for (const [p, riskLevel] of Object.entries(PROJECTS)) {
      const pack = settings.suggestPolicyPack({ projectId: p, riskLevel });
      settings.applyPolicyPack({ actor: owner, projectId: p, reason: "seed policy" });
      for (const [path, value] of Object.entries(pack.values).sort(([a], [b]) => Number(!a.startsWith("project.")) - Number(!b.startsWith("project.")))) record(p, path, "policy-template", null, value, true);
    }
    const floorOk = (p, path, value) => {
      if (PROJECTS[p] !== "high") return true;
      if (path === "budget.tokenHardCap") return value <= 100000;
      if (path === "automation.mode") return AUTOMATION_MODES.indexOf(value) <= AUTOMATION_MODES.indexOf("approval-required");
      return true;
    };
    const expected = (p, path, run) => {
      for (const [layer, r] of [["run-override", run], ["project-override", null], ["policy-template", null]]) {
        if (layer === "run-override" && !run) continue;
        const entry = model.get(scopeKey(p, path, layer, r));
        if (entry?.active) return entry.value;
      }
      return undefined;
    };
    for (let step = 0; step < 250; step += 1) {
      const p = pick(Object.keys(PROJECTS)); const path = pick(Object.keys(PATHS)); const op = random();
      const layer = random() < 0.6 ? "project-override" : "run-override"; const run = layer === "run-override" ? pick(RUNS) : null;
      const current = model.get(scopeKey(p, path, layer, run));
      const where = `seed=${seed} step=${step} ${p} ${path} ${layer} ${run}`;
      if (op < 0.5) {
        const value = pick(PATHS[path]); const stale = random() < 0.15; const expectedVersion = stale ? (current?.version ?? 0) + 1 : (current?.version ?? 0);
        if (stale) assert.throws(() => settings.setValue({ actor: admin, projectId: p, path, layer, runId: run, value, expectedVersion, reason: "random set" }), code("STALE_SETTINGS_VERSION"), where);
        else if (!floorOk(p, path, value)) assert.throws(() => settings.setValue({ actor: admin, projectId: p, path, layer, runId: run, value, expectedVersion, reason: "random set" }), code("POLICY_FLOOR_VIOLATION"), where);
        else { settings.setValue({ actor: admin, projectId: p, path, layer, runId: run, value, expectedVersion, reason: "random set" }); record(p, path, layer, run, value, true); }
      } else if (op < 0.7) {
        if (current?.active) { settings.removeOverride({ actor: admin, projectId: p, path, layer, runId: run, expectedVersion: current.version, reason: "random remove" }); record(p, path, layer, run, current.value, false); }
        else assert.throws(() => settings.removeOverride({ actor: admin, projectId: p, path, layer, runId: run, expectedVersion: current?.version ?? 1, reason: "random remove" }), code("SETTING_NOT_FOUND"), where);
      } else if (op < 0.9) {
        const candidates = (historyOf.get(`${p}|${path}`) ?? []).filter(item => !item.removal);
        if (candidates.length) {
          const target = pick(candidates);
          const restored = settings.rollback({ actor: admin, projectId: p, path, toVersion: target.version, reason: "random rollback" });
          assert.deepEqual(restored.value, target.value, where);
          record(p, path, target.layer, target.run, target.value, true);
        }
      } else {
        assert.throws(() => settings.setValue({ actor: admin, projectId: p, path: "security.projectIsolation", value: false, reason: "bypass" }), code("INVARIANT_WEAKENING_FORBIDDEN"), where);
        assert.throws(() => settings.setValue({ actor: admin, projectId: p, path, layer: "policy-template", value: pick(PATHS[path]), reason: "bypass" }), code("TEMPLATE_WRITE_FORBIDDEN"), where);
        assert.throws(() => settings.setValue({ actor: admin, projectId: p, path: "security.projectIsolation", layer: "hero-invariant", value: true, reason: "bypass" }), code("INVARIANT_WRITE_FORBIDDEN"), where);
      }
      for (const run of [null, ...RUNS]) {
        const want = expected(p, path, run);
        if (want === undefined) assert.throws(() => settings.effective({ projectId: p, path, runId: run }), code("SETTING_NOT_FOUND"), `${where} read ${run}`);
        else assert.deepEqual(settings.effective({ projectId: p, path, runId: run }).value, want, `${where} read ${run}`);
      }
      assert.equal(settings.effective({ projectId: p, path: "security.projectIsolation" }).value, true, where);
    }
    // Restart: hydrating the persisted rows reproduces every effective value and diff.
    const restarted = createProjectSettingsRegistry({ now });
    for (const p of Object.keys(PROJECTS)) for (const row of persistedRows(settings, p, [...Object.keys(PATHS), "project.type", "project.riskLevel"])) restarted.hydrateRecord(row);
    for (const p of Object.keys(PROJECTS)) for (const path of Object.keys(PATHS)) {
      for (const run of [null, ...RUNS]) assert.deepEqual(restarted.explain({ projectId: p, path, runId: run }).effective?.value, settings.explain({ projectId: p, path, runId: run }).effective?.value, `seed=${seed} restart ${p} ${path} ${run}`);
      assert.deepEqual(restarted.changeLog({ projectId: p, path }).map(entry => entry.diff), settings.changeLog({ projectId: p, path }).map(entry => entry.diff), `seed=${seed} diff ${p} ${path}`);
    }
  }
});

test("BO-051 Settings API exposes explain, change log, readiness, remove-override and policy data to the Workspace overview", async t => {
  const access = createProjectAccessRegistry({ ownerUserId: "hero-owner", ownerUser: { email: "owner@example.test", displayName: "Owner" }, now });
  const identity = createHumanIdentity({ accessRegistry: access, sessionSecret: "settings-http-session-secret-1234567890", now, owner: { userId: "hero-owner", email: "owner@example.test", password: "Owner password 123", mfaSecret: "owner-mfa-secret-for-settings" } });
  const challenge = identity.beginLogin({ email: "owner@example.test", password: "Owner password 123" });
  const session = identity.completeLogin({ challengeId: challenge.challengeId, mfaCode: createTotpCode("owner-mfa-secret-for-settings", Math.floor(Date.parse(now()) / 1000)) });
  const projectSettings = createProjectSettingsRegistry({ now });
  const projectWorkspace = createProjectWorkspace({ ownerUserId: "hero-owner", now, settings: projectSettings });
  const app = createHeroServer({ host: "127.0.0.1", port: 0, now, projectAccessRegistry: access, humanIdentity: identity, projectSettings, projectWorkspace });
  const address = await app.start(); t.after(() => app.stop());
  const base = `http://127.0.0.1:${address.port}`;
  const headers = { authorization: `Bearer ${session.token}`, "content-type": "application/json" };
  const call = async (path, init = {}) => { const response = await fetch(`${base}${path}`, { headers, ...init }); return { status: response.status, body: await response.json() }; };

  const created = await call("/api/projects", { method: "POST", body: JSON.stringify({ projectId: "project-ui", name: "UI", idempotencyKey: "settings-ui-create-001", intake: { goal: "Settings UI", riskLevel: "high" } }) });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  let overview = (await call("/api/projects/project-ui/workspace-overview")).body.overview;
  assert.equal(overview.policyPack.state, "suggested");
  assert.equal(overview.policyReadiness.ready, false);
  const approved = await call("/api/projects/project-ui/foundation/approve", { method: "POST", body: JSON.stringify({ proposalId: created.body.foundationProposal.proposalId, expectedVersion: 1, riskApproval: true }) });
  assert.equal(approved.status, 200, JSON.stringify(approved.body));

  const weaker = await call("/api/projects/project-ui/settings", { method: "POST", body: JSON.stringify({ path: "automation.mode", value: "propose-first", layer: "project-override", reason: "faster" }) });
  assert.equal(weaker.status, 409); assert.equal(weaker.body.code, "POLICY_FLOOR_VIOLATION");
  const template = await call("/api/projects/project-ui/settings", { method: "POST", body: JSON.stringify({ path: "automation.mode", value: "approval-required", layer: "policy-template", reason: "direct" }) });
  assert.equal(template.status, 403); assert.equal(template.body.code, "TEMPLATE_WRITE_FORBIDDEN");
  const set = await call("/api/projects/project-ui/settings", { method: "POST", body: JSON.stringify({ path: "ai.defaultModel", value: "terra", layer: "project-override", expectedVersion: 0, reason: "Try terra", impact: "lower cost" }) });
  assert.equal(set.status, 200, JSON.stringify(set.body));

  const explain = await call("/api/projects/project-ui/settings/explain?path=ai.defaultModel");
  assert.equal(explain.body.explanation.effective.value, "terra");
  assert.deepEqual(explain.body.explanation.chain.map(link => link.status), ["not-applicable", "winner", "shadowed", "absent"]);
  const changes = await call("/api/projects/project-ui/settings/changes?path=ai.defaultModel");
  assert.deepEqual(changes.body.changes.at(-1).diff, { kind: "added", before: null, after: "terra" });
  assert.equal((await call("/api/projects/project-ui/settings/readiness")).body.readiness.ready, true);

  overview = (await call("/api/projects/project-ui/workspace-overview")).body.overview;
  const model = overview.settings.find(item => item.path === "ai.defaultModel");
  assert.equal(model.layer, "project-override"); assert.equal(model.chain.length, 4);
  assert.equal(overview.settings.find(item => item.path === "automation.mode").floor.value, "approval-required");
  assert.ok(overview.settingChanges.some(change => change.path === "ai.defaultModel" && change.reason === "Try terra"));
  assert.equal(overview.policyPack.state, "applied");

  const stale = await call("/api/projects/project-ui/settings/remove-override", { method: "POST", body: JSON.stringify({ path: "ai.defaultModel", expectedVersion: set.body.setting.version + 1, reason: "stale" }) });
  assert.equal(stale.status, 409); assert.equal(stale.body.code, "STALE_SETTINGS_VERSION");
  const removed = await call("/api/projects/project-ui/settings/remove-override", { method: "POST", body: JSON.stringify({ path: "ai.defaultModel", expectedVersion: set.body.setting.version, reason: "Back to template" }) });
  assert.equal(removed.status, 200, JSON.stringify(removed.body));
  assert.equal((await call("/api/projects/project-ui/settings/explain?path=ai.defaultModel")).body.explanation.effective.layer, "policy-template");
  assert.equal((await fetch(`${base}/project-settings-contract`)).status, 200);
});
