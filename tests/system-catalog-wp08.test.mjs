import assert from "node:assert/strict";
import test from "node:test";

import { getSystemCatalogContractSummary, validateSystemCatalogContract, SYSTEM_ENTITY_TYPES } from "../packages/contracts/src/system-catalog.mjs";
import { createGithubLiveDiscoverySource, createSystemCatalog, diffMetadata, normalizeGithubSnapshot, SystemCatalogError } from "../packages/domain/src/system-catalog.mjs";
import { createPostgresSystemCatalogStore } from "../packages/adapters/src/postgresql-system-catalog-store.mjs";

const now = () => "2026-10-06T10:00:00.000Z";
const owner = { subject: "hero-owner", role: "project-owner" };
const admin = { subject: "project-admin", role: "admin" };
const viewer = { subject: "project-viewer", role: "viewer" };
const code = expected => error => error instanceof SystemCatalogError && error.code === expected;
const P = "project-shop";
const snapshot = { full_name: "farhaddgm/shop", default_branch: "develop", private: true, archived: false, topics: ["shop", "api"], languages: { JavaScript: 10, CSS: 2 }, branch_protection: { required_approving_review_count: 1, required_status_checks: { strict: true } } };

function seeded() {
  const catalog = createSystemCatalog({ now });
  const add = (entityId, type, metadata = {}, lifecycle = "planned") => catalog.register({ actor: admin, projectId: P, entityId, type, name: entityId, lifecycle, metadata });
  add("shop", "project");
  add("shop-web", "application", { owner: "mahsulo" }, "active");
  add("shop-api", "service", { owner: "developero" }, "active");
  add("shop-repo", "repository", { provider: "github", defaultBranch: "main", fullName: "farhaddgm/shop", desired: { provider: "github", fullName: "farhaddgm/shop", defaultBranch: "main", visibility: "private", topics: ["api", "shop"] } }, "active");
  add("shop-orders", "api", { protocol: "http" });
  add("shop-db", "data", { classification: "confidential" });
  add("shop-test", "environment", { tier: "test" });
  add("shop-node-1", "server", { environment: "shop-test" });
  add("shop-cart", "component");
  return { catalog, add };
}

test("BO-089 contract: lifecycle transitions, per-type rules and typed relations", () => {
  assert.deepEqual(validateSystemCatalogContract(), []);
  const summary = getSystemCatalogContractSummary();
  assert.equal(summary.version, "1.2"); assert.deepEqual(summary.transitions.retired, []);
  assert.match(summary.liveDiscovery, /separate authorization/);
  const { catalog, add } = seeded();
  assert.throws(() => add("bad-env", "environment", { tier: "prod-ish" }), code("ENTITY_METADATA_INVALID"));
  assert.throws(() => add("half-repo", "repository", { provider: "github" }, "active"), code("ENTITY_METADATA_INCOMPLETE"));
  assert.throws(() => add("leaky", "service", { owner: "x", config: { apiKey: "nope" } }), code("SENSITIVE_METADATA_REJECTED"));
  assert.throws(() => add("shop-web", "service", { owner: "x" }), code("ENTITY_TYPE_IMMUTABLE"));
  assert.throws(() => catalog.register({ actor: viewer, projectId: P, entityId: "viewer-entity", type: "component", name: "v" }), code("PROJECT_WRITE_REQUIRED"));
  const db = catalog.list({ projectId: P, type: "data" })[0];
  assert.throws(() => catalog.transition({ actor: admin, projectId: P, entityId: "shop-db", to: "deprecated", expectedVersion: db.version, reason: "skip ahead" }), code("LIFECYCLE_TRANSITION_INVALID"));
  assert.throws(() => catalog.transition({ actor: admin, projectId: P, entityId: "shop-db", to: "active", expectedVersion: 0, reason: "stale" }), code("STALE_ENTITY"));
  const active = catalog.transition({ actor: admin, projectId: P, entityId: "shop-db", to: "active", expectedVersion: db.version, reason: "go live" });
  assert.equal(active.lifecycle, "active");
  assert.deepEqual(catalog.history({ projectId: P, entityId: "shop-db" }).map(item => [item.version, item.lifecycle]), [[1, "planned"], [2, "active"]]);
});

test("BO-090 all nine entity types register and link only through valid relations; cycles are refused", () => {
  const { catalog } = seeded();
  assert.deepEqual([...new Set(catalog.list({ projectId: P }).map(item => item.type))].sort(), [...SYSTEM_ENTITY_TYPES].sort());
  const link = (from, to, relation) => catalog.link({ actor: admin, projectId: P, fromEntityId: from, toEntityId: to, relation });
  link("shop", "shop-web", "contains"); link("shop-web", "shop-api", "depends-on"); link("shop-api", "shop-orders", "exposes"); link("shop-api", "shop-db", "writes");
  link("shop-api", "shop-node-1", "hosted-on"); link("shop-node-1", "shop-test", "runs-in"); link("shop-api", "shop-repo", "built-from");
  assert.throws(() => link("shop-db", "shop-api", "hosted-on"), code("RELATION_TYPE_MISMATCH"));
  assert.throws(() => link("shop-api", "shop-web", "teleports-to"), code("RELATION_INVALID"));
  assert.throws(() => link("shop-api", "shop-web", "depends-on"), code("DEPENDENCY_CYCLE"));
  assert.equal(link("shop-web", "shop-api", "depends-on").version, 1, "re-linking an active link is idempotent");
  const graph = catalog.graph({ projectId: P });
  assert.equal(graph.nodes.length, 9); assert.equal(graph.edges.length, 7);
  assert.deepEqual(catalog.blastRadius({ projectId: P, entityId: "shop-db" }), ["shop", "shop-api", "shop-db", "shop-web"]);
  const repo = catalog.list({ projectId: P, type: "repository" })[0];
  catalog.transition({ actor: admin, projectId: P, entityId: "shop-repo", to: "deprecated", expectedVersion: repo.version, reason: "moving to monorepo" });
  assert.throws(() => catalog.transition({ actor: admin, projectId: P, entityId: "shop-repo", to: "retired", expectedVersion: repo.version + 1, reason: "drop" }), error => code("ENTITY_HAS_ACTIVE_DEPENDENTS")(error) && error.details.dependents.includes("shop-api"));
  const builtFrom = catalog.dependencies({ projectId: P, entityId: "shop-repo" })[0];
  assert.throws(() => catalog.unlink({ actor: admin, projectId: P, dependencyId: builtFrom.dependencyId, reason: "" }), code("REASON_REQUIRED"));
  catalog.unlink({ actor: admin, projectId: P, dependencyId: builtFrom.dependencyId, reason: "service now builds from the monorepo" });
  assert.equal(catalog.transition({ actor: admin, projectId: P, entityId: "shop-repo", to: "retired", expectedVersion: repo.version + 1, reason: "drop" }).lifecycle, "retired");
  assert.throws(() => link("shop-web", "shop-repo", "built-from"), code("ENTITY_RETIRED"));
  catalog.register({ actor: admin, projectId: "project-other", entityId: "other-api", type: "service", name: "other" });
  assert.throws(() => catalog.link({ actor: admin, projectId: P, fromEntityId: "shop-api", toEntityId: "other-api" }), code("ENTITY_NOT_FOUND"), "links never cross projects");
});

test("BO-091 offline GitHub snapshot discovery compares observed metadata with the desired catalog; live calls are refused", async () => {
  const observed = normalizeGithubSnapshot(snapshot);
  assert.deepEqual(observed, { provider: "github", fullName: "farhaddgm/shop", defaultBranch: "develop", visibility: "private", archived: false, topics: ["api", "shop"], languages: ["CSS", "JavaScript"], branchProtection: { requiredReviews: 1, requireStatusChecks: true } });
  assert.throws(() => normalizeGithubSnapshot({}), code("DISCOVERY_SNAPSHOT_INVALID"));
  await assert.rejects(createGithubLiveDiscoverySource().fetchRepository("farhaddgm/shop"), code("GITHUB_LIVE_CALL_NOT_AUTHORIZED"));
  const { catalog } = seeded();
  const { inventory, proposal } = catalog.ingestGithubSnapshot({ actor: admin, projectId: P, repositoryEntityId: "shop-repo", snapshot });
  assert.equal(inventory.state, "recorded-no-external-fetch"); assert.equal(inventory.source, "github-snapshot");
  assert.deepEqual(proposal.changes.map(change => [change.path, change.kind]), [["archived", "unexpected-observed"], ["branchProtection", "unexpected-observed"], ["defaultBranch", "changed"], ["languages", "unexpected-observed"]]);
  assert.throws(() => catalog.ingestGithubSnapshot({ actor: admin, projectId: P, repositoryEntityId: "shop-repo", snapshot: { ...snapshot, full_name: "someone/else" } }), code("DISCOVERY_REPOSITORY_MISMATCH"));
  assert.throws(() => catalog.ingestGithubSnapshot({ actor: admin, projectId: P, repositoryEntityId: "shop-api", snapshot }), code("REPOSITORY_REQUIRED"));
  assert.throws(() => catalog.detectDrift({ actor: admin, projectId: P, entityId: "shop-api", observed: {}, source: "github-live" }), code("DISCOVERY_SOURCE_INVALID"));
  assert.deepEqual(diffMetadata({ a: { b: 1, c: 2 } }, { a: { b: 1, c: 3 } }), [{ path: "a.c", kind: "changed", desired: 2, observed: 3 }]);
});

test("BO-092 drift becomes a proposal that a human resolves; nothing is overwritten automatically", () => {
  const { catalog } = seeded();
  const desiredBefore = catalog.list({ projectId: P, type: "repository" })[0].metadata.desired;
  const first = catalog.detectDrift({ actor: admin, projectId: P, entityId: "shop-repo", observed: { ...desiredBefore, defaultBranch: "develop" } });
  assert.equal(first.state, "proposed"); assert.equal(first.overwrite, "forbidden");
  assert.deepEqual(catalog.list({ projectId: P, type: "repository" })[0].metadata.desired, desiredBefore, "detection alone changes nothing");
  assert.equal(catalog.detectDrift({ actor: admin, projectId: P, entityId: "shop-repo", observed: { ...desiredBefore, defaultBranch: "develop" } }).deduplicated, true, "the same drift is not proposed twice");
  const second = catalog.detectDrift({ actor: admin, projectId: P, entityId: "shop-repo", observed: { ...desiredBefore, defaultBranch: "release" } });
  assert.equal(catalog.listDriftProposals({ projectId: P }).find(item => item.driftProposalId === first.driftProposalId).state, "superseded");
  assert.throws(() => catalog.resolveDrift({ actor: viewer, projectId: P, driftProposalId: second.driftProposalId, resolution: "reject", reason: "no" }), code("PROJECT_WRITE_REQUIRED"));
  assert.throws(() => catalog.resolveDrift({ actor: admin, projectId: "project-other", driftProposalId: second.driftProposalId, resolution: "reject", reason: "wrong project" }), code("DRIFT_PROPOSAL_NOT_FOUND"));
  const fix = catalog.resolveDrift({ actor: admin, projectId: P, driftProposalId: second.driftProposalId, resolution: "fix-source", reason: "the branch must go back to main" });
  assert.equal(fix.proposal.state, "accepted-fix-source"); assert.equal(fix.proposal.remediation.automated, false); assert.equal(fix.entity, null);
  assert.throws(() => catalog.resolveDrift({ actor: admin, projectId: P, driftProposalId: second.driftProposalId, resolution: "reject", reason: "again" }), code("DRIFT_PROPOSAL_CLOSED"));
  const third = catalog.detectDrift({ actor: admin, projectId: P, entityId: "shop-repo", observed: { ...desiredBefore, defaultBranch: "trunk" } });
  const adopted = catalog.resolveDrift({ actor: owner, projectId: P, driftProposalId: third.driftProposalId, resolution: "adopt-observed", reason: "trunk is the new standard" });
  assert.equal(adopted.entity.metadata.desired.defaultBranch, "trunk"); assert.equal(adopted.entity.adoptedFromProposal, third.driftProposalId);
  const stale = catalog.detectDrift({ actor: admin, projectId: P, entityId: "shop-repo", observed: { ...desiredBefore, defaultBranch: "x" } });
  catalog.attachReferences({ actor: admin, projectId: P, entityId: "shop-repo", references: { document: "hero://docs/repo" } });
  assert.throws(() => catalog.resolveDrift({ actor: admin, projectId: P, driftProposalId: stale.driftProposalId, resolution: "adopt-observed", reason: "late" }), code("DRIFT_PROPOSAL_STALE"));
  assert.equal(catalog.detectDrift({ actor: admin, projectId: P, entityId: "shop-db", observed: {} }).state, "no-drift");
});

test("catalog records persist append-only and replay in any order", async () => {
  const { catalog } = seeded();
  catalog.link({ actor: admin, projectId: P, fromEntityId: "shop-web", toEntityId: "shop-api" });
  const proposal = catalog.detectDrift({ actor: admin, projectId: P, entityId: "shop-repo", observed: { defaultBranch: "develop" } });
  catalog.resolveDrift({ actor: admin, projectId: P, driftProposalId: proposal.driftProposalId, resolution: "adopt-observed", reason: "accept develop" });
  catalog.registerKnowledge({ actor: admin, projectId: P, knowledgeId: "knowledge-shop", kind: "decision", title: "Branching", sourceRef: "hero://docs/branching" });
  const tables = { entities: [], records: [] };
  const client = { async query(sql, values) {
    if (sql.startsWith("INSERT INTO system_catalog_entities")) { tables.entities.push({ entity_id: values[0], entity_version: values[1], project_id: values[2], lifecycle: values[4], metadata: JSON.parse(values[5]), actor_id: values[6], recorded_at: now() }); return { rows: [] }; }
    if (sql.startsWith("INSERT INTO system_catalog_records")) { tables.records.push({ record_key: values[0], record_version: values[1], project_id: values[2], record_kind: values[3], state: values[4], metadata: JSON.parse(values[5]), actor_id: values[6], recorded_at: now() }); return { rows: [] }; }
    if (sql.includes("FROM system_catalog_entities")) return { rows: [...tables.entities, { entity_id: "legacy", entity_version: 1, project_id: P, lifecycle: "planned", metadata: {}, actor_id: "x" }] };
    return { rows: tables.records };
  } };
  const store = createPostgresSystemCatalogStore({ client });
  for (const record of catalog.drainRecords()) await store.appendRecord(record);
  assert.ok(tables.entities.length >= 9 && tables.records.length >= 4);
  const restored = createSystemCatalog({ now });
  for (const record of [...await store.listRecords()].reverse()) restored.hydrate(record);
  assert.equal(restored.list({ projectId: P, type: "repository" })[0].metadata.desired.defaultBranch, "develop");
  assert.equal(restored.listDriftProposals({ projectId: P })[0].state, "accepted-adopt-observed");
  assert.equal(restored.dependencies({ projectId: P, entityId: "shop-api" }).length, 1);
  assert.equal(restored.history({ projectId: P, entityId: "shop-repo" }).length, 2);
  assert.equal(restored.search({ projectId: P, query: "branching" }).length, 1);
  assert.equal(restored.list({ projectId: P }).some(item => item.entityId === "legacy"), false, "pre-v1.1 rows without payload are skipped");
  const next = restored.detectDrift({ actor: admin, projectId: P, entityId: "shop-db", observed: { classification: "public" } });
  assert.notEqual(next.driftProposalId, proposal.driftProposalId, "proposal ids keep counting after a restart");
  await assert.rejects(store.appendRecord({ kind: "entity", key: "x-entity", version: 1, projectId: P, actorId: "a-actor", payload: { entity: { type: "service", lifecycle: "planned", password: "x" } } }), error => error.code === "SENSITIVE_PERSISTENCE_FORBIDDEN");
});

test("BO-090..092 HTTP: catalog writes need a write grant, drift is resolved by a person, other projects stay hidden", async t => {
  const { createProjectSettingsRegistry } = await import("../packages/domain/src/project-settings.mjs");
  const { createProjectWorkspace } = await import("../packages/domain/src/project-workspace.mjs");
  const { createHeroServer } = await import("../apps/control-plane/src/server.mjs");
  const { createHumanIdentity, createTotpCode } = await import("../packages/domain/src/human-identity.mjs");
  const { createProjectAccessRegistry } = await import("../packages/domain/src/project-access.mjs");
  const access = createProjectAccessRegistry({ ownerUserId: "hero-owner", ownerUser: { email: "owner@example.test", displayName: "Owner" }, now });
  const identity = createHumanIdentity({ accessRegistry: access, sessionSecret: "catalog-http-session-secret-1234567890", now, owner: { userId: "hero-owner", email: "owner@example.test", password: "Owner password 123", mfaSecret: "owner-mfa-secret-wp08" } });
  const login = (email, password, secret) => { const challenge = identity.beginLogin({ email, password }); return identity.completeLogin({ challengeId: challenge.challengeId, mfaCode: createTotpCode(secret, Math.floor(Date.parse(now()) / 1000)) }).token; };
  const projectSettings = createProjectSettingsRegistry({ now });
  const projectWorkspace = createProjectWorkspace({ ownerUserId: "hero-owner", now, settings: projectSettings });
  for (const projectId of ["project-shop", "project-other"]) projectWorkspace.createProject({ actor: owner, projectId, name: projectId });
  for (const [userId, email, secret] of [["admin-user", "admin@example.test", "admin-mfa-secret-wp08"], ["viewer-user", "viewer@example.test", "viewer-mfa-secret-wp08"]]) identity.createUser({ actor: owner, user: { userId, email, displayName: userId, password: "User password 123", mfaSecret: secret, mfaRequired: true } });
  access.upsertGrant({ actor: owner, grant: { projectId: P, userId: "admin-user", role: "admin" } });
  access.upsertGrant({ actor: owner, grant: { projectId: P, userId: "viewer-user", role: "viewer" } });
  const app = createHeroServer({ host: "127.0.0.1", port: 0, now, projectAccessRegistry: access, humanIdentity: identity, projectSettings, projectWorkspace });
  const address = await app.start(); t.after(() => app.stop());
  const base = `http://127.0.0.1:${address.port}`;
  const tokens = { admin: login("admin@example.test", "User password 123", "admin-mfa-secret-wp08"), viewer: login("viewer@example.test", "User password 123", "viewer-mfa-secret-wp08") };
  const call = async (who, method, route, body) => { const response = await fetch(`${base}${route}`, { method, headers: { authorization: `Bearer ${tokens[who]}`, "content-type": "application/json", ...(method === "GET" ? {} : { origin: base }) }, body: body === undefined ? undefined : JSON.stringify(body) }); return { status: response.status, body: await response.json() }; };
  const root = `/api/projects/${P}/catalog`;
  assert.equal((await call("admin", "POST", root, { entityId: "shop-repo", type: "repository", name: "Shop repo", lifecycle: "active", metadata: { provider: "github", defaultBranch: "main", fullName: "farhaddgm/shop", desired: { defaultBranch: "main" } } })).status, 201);
  assert.equal((await call("admin", "POST", root, { entityId: "shop-api", type: "service", name: "Shop API" })).status, 201);
  assert.equal((await call("viewer", "POST", root, { entityId: "viewer-x", type: "component", name: "x" })).status, 403);
  assert.equal((await call("admin", "POST", `${root}/dependencies`, { fromEntityId: "shop-api", toEntityId: "shop-repo", relation: "built-from" })).status, 201);
  assert.equal((await call("admin", "POST", `${root}/dependencies`, { fromEntityId: "shop-repo", toEntityId: "shop-api", relation: "depends-on" })).body.code, "DEPENDENCY_CYCLE");
  assert.equal((await call("viewer", "GET", `${root}/graph`)).body.graph.edges.length, 1);
  const discovery = await call("admin", "POST", `${root}/discovery/github-snapshot`, { repositoryEntityId: "shop-repo", snapshot: { full_name: "farhaddgm/shop", default_branch: "develop" } });
  assert.equal(discovery.status, 201); assert.equal(discovery.body.proposal.state, "proposed");
  const proposalId = discovery.body.proposal.driftProposalId;
  assert.equal((await call("viewer", "GET", `${root}/drift?state=proposed`)).body.proposals.length, 1);
  assert.equal((await call("viewer", "POST", `${root}/drift/${proposalId}/resolve`, { resolution: "reject", reason: "no" })).status, 403);
  assert.equal((await call("admin", "POST", `/api/projects/project-other/catalog/drift/${proposalId}/resolve`, { resolution: "reject", reason: "no" })).status, 403, "no grant on the other project");
  const resolved = await call("admin", "POST", `${root}/drift/${proposalId}/resolve`, { resolution: "adopt-observed", reason: "develop is intended" });
  assert.equal(resolved.body.entity.metadata.desired.defaultBranch, "develop");
  assert.equal((await call("viewer", "GET", `${root}/entities/shop-repo/history`)).body.history.length, 2);
  assert.deepEqual((await call("viewer", "GET", `${root}/entities/shop-repo/blast-radius`)).body.entities, ["shop-api", "shop-repo"]);
  assert.equal((await call("admin", "POST", `${root}/entities/shop-api/transition`, { to: "active", expectedVersion: 1, reason: "go live" })).body.code, "ENTITY_METADATA_INCOMPLETE", "an active service needs an owner");
});
