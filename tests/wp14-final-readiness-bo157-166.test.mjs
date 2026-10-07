import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createFinalReadiness, FinalReadinessError } from "../packages/domain/src/final-readiness.mjs";
import { getFinalReadinessContractSummary, validateFinalReadinessContract } from "../packages/contracts/src/final-readiness.mjs";
import { LEGACY_COMPATIBLE_UNTIL, LEGACY_ROUTE_MIGRATIONS, legacyRouteFor, legacyStatus, successorUrl, validateRouteMigration } from "../packages/contracts/src/route-migration.mjs";
import { createPostgresDomainRecordStore } from "../packages/adapters/src/postgresql-domain-record-store.mjs";
import { auditTraceability } from "../tools/audit/traceability-audit.mjs";
import { auditNotionPlan, buildCanonicalPlan } from "../tools/audit/notion-plan.mjs";
import { createAuditFixture } from "../tools/audit/local-fixture.mjs";
import { readModelDigests, diffDigests } from "../tools/audit/read-models.mjs";
import { sha256 } from "../tools/acceptance/audit-lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let clock = Date.parse("2026-10-07T10:00:00.000Z");
const now = () => new Date(clock).toISOString();
const owner = { subject: "hero-owner", role: "project-owner" };
const admin = { subject: "project-admin", role: "admin" };
const viewer = { subject: "project-viewer", role: "viewer" };
const code = expected => error => error instanceof FinalReadinessError && error.code === expected;
const P = "project-shop";
const digest = character => `sha256:${character.repeat(64)}`;
const scenario = (kind, extra = {}) => ({ actor: admin, projectId: P, scenarioId: `scenario-${kind}`, kind, tool: "tools/audit/scenarios", toolVersion: "1.0", evidenceDigest: digest("a"), checks: { total: 10, passed: 10 }, projects: kind === "e2e-multi-project" ? [P, "project-two"] : [], ...extra });

test("BO-157 a migration plan needs a bounded future window and reports whether the old route is still compatible", () => {
  const readiness = createFinalReadiness({ now }); assert.deepEqual(validateFinalReadinessContract(), []); assert.equal(getFinalReadinessContractSummary().version, "1.1");
  const plan = { actor: admin, projectId: P, migrationId: "migration-studio", oldRoute: "/product-studio", newRoute: "/api/portal?surface=studio", compatibilityUntil: "2026-12-01T00:00:00.000Z" };
  assert.throws(() => readiness.planMigration({ ...plan, compatibilityUntil: "2026-10-01T00:00:00.000Z" }), code("MIGRATION_INVALID"));
  assert.throws(() => readiness.planMigration({ ...plan, compatibilityUntil: "2030-01-01T00:00:00.000Z" }), code("MIGRATION_WINDOW_TOO_LONG"));
  assert.throws(() => readiness.planMigration({ ...plan, newRoute: "/product-studio" }), code("MIGRATION_INVALID"));
  assert.throws(() => readiness.planMigration({ ...plan, actor: viewer }), error => error.statusCode === 403);
  const stored = readiness.planMigration(plan); assert.equal(stored.deletion, "forbidden-until-verified");
  assert.throws(() => readiness.planMigration(plan), code("MIGRATION_EXISTS"));
  assert.equal(readiness.compatibility({ actor: viewer, projectId: P, migrationId: "migration-studio" }).oldRouteStatus, "compatible");
  clock = Date.parse("2026-12-02T00:00:00.000Z"); assert.equal(readiness.compatibility({ actor: viewer, projectId: P, migrationId: "migration-studio" }).oldRouteStatus, "window-ended"); clock = Date.parse("2026-10-07T10:00:00.000Z");
  assert.throws(() => readiness.compatibility({ actor: viewer, projectId: P, migrationId: "migration-none" }), code("MIGRATION_NOT_FOUND"));
});

test("BO-159 read-model digests are compared, never asserted equal; BO-160..163 scenarios need counted tool evidence and a failing run is kept as failing", () => {
  const readiness = createFinalReadiness({ now });
  assert.equal(readiness.rebuildReadModel({ actor: admin, projectId: P, modelId: "model-a", beforeState: { a: 1 }, afterState: { a: 1 } }).equal, true);
  const differing = readiness.rebuildReadModel({ actor: admin, projectId: P, modelId: "model-b", beforeDigest: digest("1"), afterDigest: digest("2") }); assert.equal(differing.equal, false);
  assert.throws(() => readiness.rebuildReadModel({ actor: admin, projectId: P, modelId: "model-c", beforeDigest: "trust-me", afterDigest: digest("2") }), code("DIGEST_REQUIRED"));
  assert.equal(readiness.rebuildReadModel({ actor: admin, projectId: P, modelId: "model-b", beforeDigest: digest("3"), afterDigest: digest("3") }).version, 2, "a rebuilt comparison is a new version");
  assert.throws(() => readiness.recordScenario(scenario("crash-resume", { evidenceDigest: "nope" })), code("SCENARIO_EVIDENCE_REQUIRED"));
  assert.throws(() => readiness.recordScenario(scenario("crash-resume", { tool: "" })), code("SCENARIO_TOOL_REQUIRED"));
  assert.throws(() => readiness.recordScenario(scenario("crash-resume", { checks: { total: 2, passed: 3 } })), code("SCENARIO_CHECKS_INVALID"));
  assert.throws(() => readiness.recordScenario(scenario("vibes")), code("SCENARIO_KIND_INVALID"));
  assert.throws(() => readiness.recordScenario(scenario("e2e-multi-project", { projects: [P] })), code("SCENARIO_NEEDS_TWO_PROJECTS"));
  assert.throws(() => readiness.recordScenario(scenario("e2e-multi-project", { projects: ["project-a", "project-b"] })), code("SCENARIO_PROJECT_MISMATCH"));
  const failing = readiness.recordScenario(scenario("crash-resume", { checks: { total: 11, passed: 10 } })); assert.equal(failing.passed, false, "a failing run is recorded, not refused");
  assert.throws(() => readiness.recordScenario(scenario("crash-resume")), code("SCENARIO_IMMUTABLE"));
  for (const kind of ["e2e-multi-project", "adversarial-access", "test-transfer"]) readiness.recordScenario(scenario(kind));
  const review = readiness.readinessReview({ actor: admin, projectId: P, reviewId: "review-1", rollbackRef: "hero://rollback/rc38" });
  assert.equal(review.state, "draft", "a failing crash-resume run and a digest mismatch keep the review in draft");
  assert.deepEqual(review.scenarioCoverage.filter(item => !item.passed).map(item => item.kind), ["crash-resume"]);
  assert.throws(() => readiness.accept({ actor: owner, projectId: P, reviewId: "review-1", artifactIdentity: "artifact-identity-001" }), code("READINESS_NOT_COMPLETE"));
});

test("BO-164/166/168/169 traceability, a plan-only Notion projection, readiness review, owner-only immutable acceptance and a proposal-only pilot gate", () => {
  const readiness = createFinalReadiness({ now });
  assert.throws(() => readiness.setTraceability({ actor: admin, projectId: P, requirementId: "BO-NTF-001", testRef: "https://x", evidenceRef: "hero://e" }), code("TRACEABILITY_INVALID"));
  assert.equal(readiness.setTraceability({ actor: admin, projectId: P, requirementId: "BO-NTF-001", testRef: "hero://tests/wp10-inbox", evidenceRef: "hero://evidence/acceptance" }).version, 1);
  const plan = buildCanonicalPlan({ root }); const subset = plan.documents.slice(0, 3);
  assert.throws(() => readiness.prepareNotionProjection({ actor: admin, projectId: P, documentRefs: ["https://notion.so/page"] }), code("NOTION_PLAN_INVALID"));
  assert.throws(() => readiness.prepareNotionProjection({ actor: admin, projectId: P, documentRefs: [subset[0].ref], documents: [{ ref: subset[1].ref, checksum: subset[1].checksum }] }), code("NOTION_PLAN_INVALID"));
  const prepared = readiness.prepareNotionProjection({ actor: admin, projectId: P, documentRefs: subset.map(item => item.ref), documents: subset.map(item => ({ ref: item.ref, checksum: item.checksum })) }); assert.equal(prepared.writes, 0); assert.equal(prepared.mode, "plan-only-notion-write-forbidden");
  for (const kind of ["e2e-multi-project", "adversarial-access", "crash-resume", "test-transfer"]) readiness.recordScenario(scenario(kind));
  assert.throws(() => readiness.readinessReview({ actor: admin, projectId: P, reviewId: "review-x", rollbackRef: "rollback" }), code("READINESS_INVALID"));
  const review = readiness.readinessReview({ actor: admin, projectId: P, reviewId: "review-ready", gaps: [], risks: ["MFA persistence open"], limitations: ["no live connections"], rollbackRef: "hero://rollback/rc38" }); assert.equal(review.state, "ready-for-owner-acceptance");
  assert.equal(readiness.readinessReview({ actor: admin, projectId: P, reviewId: "review-gap", gaps: ["accessibility audit stale"], rollbackRef: "hero://rollback/rc38" }).state, "draft", "an open gap blocks readiness");
  assert.throws(() => readiness.readinessReview({ actor: admin, projectId: P, reviewId: "review-ready", rollbackRef: "hero://rollback/rc38" }), code("REVIEW_IMMUTABLE"));
  assert.throws(() => readiness.accept({ actor: admin, projectId: P, reviewId: "review-ready", artifactIdentity: "artifact-identity-001" }), code("OWNER_REQUIRED"));
  assert.throws(() => readiness.accept({ actor: owner, projectId: "project-other", reviewId: "review-ready", artifactIdentity: "artifact-identity-001" }), code("REVIEW_NOT_FOUND"), "an acceptance cannot cross projects");
  assert.throws(() => readiness.accept({ actor: owner, projectId: P, reviewId: "review-ready", artifactIdentity: "short" }), code("ACCEPTANCE_INVALID"));
  assert.throws(() => readiness.pilotProposal({ actor: owner, projectId: P, proposalId: "pilot-1", reviewId: "review-ready", scope: "pilot" }), code("OWNER_ACCEPTANCE_REQUIRED"));
  assert.equal(readiness.accept({ actor: owner, projectId: P, reviewId: "review-ready", artifactIdentity: "artifact-identity-001" }).decision, "accepted");
  assert.throws(() => readiness.accept({ actor: owner, projectId: P, reviewId: "review-ready", artifactIdentity: "artifact-identity-002", decision: "rework-requested" }), code("ACCEPTANCE_IMMUTABLE"));
  const pilot = readiness.pilotProposal({ actor: owner, projectId: P, proposalId: "pilot-1", reviewId: "review-ready", scope: "Test-only narrow proposal" }); assert.equal(pilot.execution, "forbidden-without-separate-pilot-authorization");
  assert.throws(() => readiness.pilotProposal({ actor: admin, projectId: P, proposalId: "pilot-2", reviewId: "review-ready", scope: "x" }), code("OWNER_REQUIRED"));
});

test("final-readiness records persist append-only and replay in any order", async () => {
  const readiness = createFinalReadiness({ now });
  readiness.planMigration({ actor: admin, projectId: P, migrationId: "migration-r", oldRoute: "/old", newRoute: "/new", compatibilityUntil: "2026-12-01T00:00:00.000Z" }); readiness.rebuildReadModel({ actor: admin, projectId: P, modelId: "model-r", beforeDigest: digest("1"), afterDigest: digest("2") }); readiness.rebuildReadModel({ actor: admin, projectId: P, modelId: "model-r", beforeDigest: digest("3"), afterDigest: digest("3") });
  for (const kind of ["e2e-multi-project", "adversarial-access", "crash-resume", "test-transfer"]) readiness.recordScenario(scenario(kind));
  readiness.readinessReview({ actor: admin, projectId: P, reviewId: "review-r", rollbackRef: "hero://rollback/x" }); readiness.accept({ actor: owner, projectId: P, reviewId: "review-r", artifactIdentity: "artifact-identity-009" }); readiness.pilotProposal({ actor: owner, projectId: P, proposalId: "pilot-r", reviewId: "review-r", scope: "narrow" });
  const rows = []; const client = { async query(sql, values) { if (sql.startsWith("INSERT")) { rows.push({ record_kind: values[1], record_key: values[2], record_version: values[3], project_id: values[4], metadata: JSON.parse(values[5]), actor_id: values[6] }); return { rows: [] }; } return { rows }; } };
  const store = createPostgresDomainRecordStore({ client }); for (const record of readiness.drainRecords()) await store.appendRecord("readiness", record);
  const restored = createFinalReadiness({ now }); for (const record of [...await store.listRecords("readiness")].reverse()) restored.hydrate(record);
  assert.deepEqual(restored.view({ actor: viewer, projectId: P }), readiness.view({ actor: viewer, projectId: P })); assert.equal(restored.view({ actor: viewer, projectId: P }).readModels[0].equal, true, "the newest comparison wins in any replay order");
  assert.throws(() => restored.accept({ actor: owner, projectId: P, reviewId: "review-r", artifactIdentity: "artifact-identity-010", decision: "rework-requested" }), code("ACCEPTANCE_IMMUTABLE"), "immutability survives a restart");
});

test("BO-157/158 legacy routes keep working inside the window with Deprecation headers, and answer 410 with their successor after it", async t => {
  assert.deepEqual(validateRouteMigration(), []); assert.equal(legacyRouteFor("/product-studio").surface, "studio"); assert.equal(legacyRouteFor("/nope"), null);
  assert.equal(legacyStatus("/workspace", "2026-10-07T00:00:00.000Z"), "compatible"); assert.equal(legacyStatus("/workspace", "2027-04-06T00:00:00.000Z"), "window-ended");
  assert.equal(successorUrl(legacyRouteFor("/project-control"), new URLSearchParams("projectId=project-alpha")), "/api/portal?surface=control&projectId=project-alpha");
  assert.equal(successorUrl(legacyRouteFor("/backoffice"), new URLSearchParams("projectId=project-alpha")), "/portfolio?select=project");
  let moment = Date.parse("2026-10-07T10:00:00.000Z"); const inside = () => new Date(moment).toISOString();
  const fixture = await createAuditFixture({ now: inside }); t.after(() => fixture.stop());
  for (const migration of LEGACY_ROUTE_MIGRATIONS) {
    const response = await fetch(`${fixture.base}${migration.legacy}?projectId=project-alpha`, { redirect: "manual", headers: { cookie: `__Host-hero-human-session=${encodeURIComponent(fixture.tokens.owner)}` } });
    assert.ok([200, 302, 303, 307, 308].includes(response.status), `${migration.legacy} still answers inside the window (${response.status})`);
    assert.equal(response.headers.get("deprecation"), "true", migration.legacy); assert.match(response.headers.get("sunset"), /2027/); assert.match(response.headers.get("link"), /rel="successor-version"/);
  }
  const replacement = await fixture.page("owner", "studio"); assert.equal(replacement.status, 200, "the successor serves the page the legacy route used to");
  moment = Date.parse("2027-04-06T00:00:00.000Z");
  for (const migration of LEGACY_ROUTE_MIGRATIONS) {
    const response = await fetch(`${fixture.base}${migration.legacy}?projectId=project-alpha`, { redirect: "manual", headers: { cookie: `__Host-hero-human-session=${encodeURIComponent(fixture.tokens.owner)}` } }); const body = await response.json();
    assert.equal(response.status, 410, migration.legacy); assert.equal(body.code, "LEGACY_ROUTE_RETIRED"); assert.ok(body.successor.startsWith("/")); assert.match(response.headers.get("link"), /successor-version/);
  }
});

test("BO-157..166 HTTP: readiness roles, evidence, project isolation, digests across a restart and the final-readiness view", async t => {
  const fixture = await createAuditFixture({ now }); t.after(() => fixture.stop()); const { call } = fixture; const root_ = "/api/projects/project-alpha"; await fixture.seed();
  const post = (who, body) => call(who, "POST", `${root_}/final-readiness`, body);
  assert.equal((await post("viewer", { action: "plan-migration" })).status, 403);
  assert.equal((await post("admin", { action: "explode" })).status, 400);
  assert.equal((await post("admin", { action: "plan-migration", migrationId: "migration-http", oldRoute: "/product-studio", newRoute: "/api/portal?surface=studio", compatibilityUntil: "2026-12-01T00:00:00.000Z" })).status, 201);
  assert.equal((await post("admin", { action: "record-scenario", scenarioId: "scenario-http", kind: "adversarial-access", tool: "tools/audit/scenarios", toolVersion: "1.0", evidenceDigest: "claimed", checks: { total: 1, passed: 1 } })).status, 400, "a scenario without a real digest is refused");
  const recorded = await post("admin", { action: "record-scenario", scenarioId: "scenario-http", kind: "adversarial-access", tool: "tools/audit/scenarios", toolVersion: "1.0", evidenceDigest: digest("5"), checks: { total: 17, passed: 16 }, passed: true }); assert.equal(recorded.body.result.passed, false, "a client cannot assert a pass");
  assert.equal((await post("admin", { action: "accept", reviewId: "review-http", artifactIdentity: "artifact-identity-001" })).status, 403, "acceptance is the owner's alone");
  assert.equal((await post("owner", { action: "accept", reviewId: "review-http", artifactIdentity: "artifact-identity-001" })).status, 404);
  const view = (await call("viewer", "GET", `${root_}/final-readiness`)).body.readiness; assert.equal(view.migrations.length, 1); assert.equal(view.scenarios[0].passed, false);
  assert.equal((await call("admin", "GET", "/api/projects/project-beta/final-readiness")).status, 403);
  // digests are stable across a read-only repeat
  const first = await readModelDigests(call, "project-alpha"); const second = await readModelDigests(call, "project-alpha"); assert.deepEqual(diffDigests(first, second), []); assert.equal(Object.keys(first).length, 17);
  assert.notEqual(sha256(first), sha256({}));
});

test("BO-164/166 the repository's own traceability and Notion plan audits pass", () => {
  const trace = auditTraceability({ root }).finish(); assert.equal(trace.checks.passed, trace.checks.total, trace.findings.join(" | ")); assert.ok(trace.checks.total >= 14);
  const { recorder, plan } = auditNotionPlan({ root }); const verdict = recorder.finish(); assert.equal(verdict.checks.passed, verdict.checks.total, verdict.findings.join(" | "));
  assert.equal(plan.writes, 0); assert.ok(plan.documents.length > 100); assert.equal(typeof plan.classificationReview.current, "boolean");
  assert.equal(fs.readFileSync(path.join(root, "config/product-development/notion-allowlist.json"), "utf8").includes('"bulk_write_approved": false'), true, "bulk writes remain unapproved");
});
