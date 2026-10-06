import assert from "node:assert/strict";
import test from "node:test";

import { getSystemCatalogContractSummary, validateSystemCatalogContract } from "../packages/contracts/src/system-catalog.mjs";
import { createSystemCatalog, SystemCatalogError } from "../packages/domain/src/system-catalog.mjs";
import { createCommandCenter } from "../packages/domain/src/command-center.mjs";
import { createPostgresSystemCatalogStore } from "../packages/adapters/src/postgresql-system-catalog-store.mjs";

const now = () => "2026-10-06T10:00:00.000Z";
const owner = { subject: "hero-owner", role: "project-owner" };
const admin = { subject: "project-admin", role: "admin" };
const viewer = { subject: "project-viewer", role: "viewer" };
const code = expected => error => error instanceof SystemCatalogError && error.code === expected;
const P = "project-shop";
const DIGEST = `sha256:${"b".repeat(64)}`;

function seeded(options = {}) {
  const catalog = createSystemCatalog({ now, teamExists: id => ["developero", "testero"].includes(id), ...options });
  const add = (entityId, type, metadata = {}, lifecycle = "planned") => catalog.register({ actor: admin, projectId: P, entityId, type, name: entityId, lifecycle, metadata });
  add("shop-web", "application", { owner: "hero-owner" }, "active"); add("shop-api", "service", { owner: "hero-owner" }, "active"); add("shop-db", "data", { classification: "internal" }); add("shop-repo", "repository", { provider: "github", defaultBranch: "main", fullName: "a/b", desired: { defaultBranch: "main" } }, "active");
  catalog.link({ actor: admin, projectId: P, fromEntityId: "shop-web", toEntityId: "shop-api" }); catalog.link({ actor: admin, projectId: P, fromEntityId: "shop-api", toEntityId: "shop-db", relation: "writes" });
  return catalog;
}

test("BO-093 typed references are validated and one view joins owner, team, document, run, artifact and health", () => {
  assert.deepEqual(validateSystemCatalogContract(), []); assert.equal(getSystemCatalogContractSummary().version, "1.2");
  const catalog = seeded({ healthFor: (projectId, entityId) => entityId === "shop-api" ? "degraded" : null });
  const refs = { owner: "hero-owner", team: "developero", document: "hero://docs/shop-api", run: "run-shop-1", artifact: DIGEST, health: "healthy" };
  const attached = catalog.attachReferences({ actor: admin, projectId: P, entityId: "shop-api", references: refs });
  assert.deepEqual(attached.metadata.references, refs);
  assert.throws(() => catalog.attachReferences({ actor: admin, projectId: P, entityId: "shop-api", references: { team: "shadow-team" } }), code("REFERENCE_VALUE_INVALID"));
  assert.throws(() => catalog.attachReferences({ actor: admin, projectId: P, entityId: "shop-api", references: { document: "https://evil.example/x" } }), code("REFERENCE_VALUE_INVALID"));
  assert.throws(() => catalog.attachReferences({ actor: admin, projectId: P, entityId: "shop-api", references: { artifact: "latest" } }), code("REFERENCE_VALUE_INVALID"));
  assert.throws(() => catalog.attachReferences({ actor: admin, projectId: P, entityId: "shop-api", references: { colour: "red" } }), code("REFERENCE_INVALID"));
  assert.throws(() => catalog.attachReferences({ actor: viewer, projectId: P, entityId: "shop-api", references: { owner: "x-owner" } }), code("PROJECT_WRITE_REQUIRED"));
  const view = catalog.entityView({ actor: viewer, projectId: P, entityId: "shop-api" });
  assert.equal(view.health, "degraded"); assert.equal(view.healthSource, "health-engine", "live health beats a stored label");
  assert.equal(catalog.entityView({ actor: viewer, projectId: P, entityId: "shop-web" }).healthSource, "none");
  assert.deepEqual(view.blastRadius, ["shop-api", "shop-web"]);
});

test("BO-094/095 document graph: kinds, supersession, cycles and permission-aware search", () => {
  const catalog = seeded();
  const doc = (knowledgeId, kind, title, extra = {}) => catalog.registerKnowledge({ actor: admin, projectId: P, knowledgeId, kind, title, sourceRef: `hero://docs/${knowledgeId}`, ...extra });
  doc("decision-db", "decision", "Use PostgreSQL for orders", { entityIds: ["shop-db"] }); doc("decision-db-v2", "decision", "Use PostgreSQL 16 for orders"); doc("research-db", "research", "Database comparison"); doc("evidence-load", "evidence", "Load test results", { tags: ["perf"] });
  doc("roadmap-q4", "roadmap", "Q4 roadmap"); doc("pricing-note", "note", "Discount floor is thirty percent", { sensitivity: "restricted" });
  assert.throws(() => doc("bad-kind", "gossip", "x"), code("KNOWLEDGE_KIND_INVALID"));
  assert.throws(() => doc("bad-entity", "note", "x", { entityIds: ["nope-entity"] }), code("ENTITY_NOT_FOUND"));
  assert.throws(() => catalog.registerKnowledge({ actor: admin, projectId: P, knowledgeId: "bad-src", kind: "note", title: "x", sourceRef: "https://x.example" }), code("KNOWLEDGE_SOURCE_INVALID"));
  const link = (from, to, relation) => catalog.linkKnowledge({ actor: admin, projectId: P, fromKnowledgeId: from, toKnowledgeId: to, relation });
  link("decision-db-v2", "decision-db", "supersedes"); link("evidence-load", "decision-db-v2", "evidences"); link("decision-db-v2", "research-db", "depends-on");
  assert.throws(() => link("decision-db", "decision-db-v2", "supersedes"), code("KNOWLEDGE_CYCLE"));
  assert.throws(() => link("research-db", "decision-db-v2", "depends-on"), code("KNOWLEDGE_CYCLE"));
  assert.throws(() => link("decision-db", "decision-db", "references"), code("KNOWLEDGE_SELF_REFERENCE"));
  assert.throws(() => link("decision-db", "research-db", "befriends"), code("KNOWLEDGE_RELATION_INVALID"));
  const graph = catalog.documentGraph({ actor: viewer, projectId: P });
  assert.equal(graph.nodes.find(node => node.knowledgeId === "decision-db").current, false, "a superseded decision is marked, never removed");
  assert.equal(graph.nodes.find(node => node.knowledgeId === "decision-db-v2").current, true); assert.equal(graph.edges.length, 3);
  assert.equal(graph.nodes.find(node => node.knowledgeId === "pricing-note").title, "[restricted document]");

  assert.equal(catalog.search({ actor: viewer, projectId: P, query: "discount" }).length, 0, "restricted text is not searchable by a viewer");
  assert.equal(catalog.search({ actor: admin, projectId: P, query: "discount" })[0].knowledgeId, "pricing-note");
  const results = catalog.search({ actor: viewer, projectId: P, query: "postgresql" });
  assert.deepEqual(results.map(item => item.resultType), ["knowledge", "knowledge"]);
  assert.deepEqual(catalog.search({ actor: viewer, projectId: P, query: "shop", types: ["entity"] }).every(item => item.resultType === "entity"), true);
  assert.throws(() => catalog.search({ actor: viewer, projectId: P, query: "x" }), code("SEARCH_QUERY_INVALID"));
  assert.equal(catalog.search({ actor: viewer, projectId: "project-other", query: "postgresql" }).length, 0, "another project's data is never returned");
});

test("BO-096 impact lists every affected entity with its dependency path, and a command card shows it", () => {
  const catalog = seeded();
  const impact = catalog.impact({ projectId: P, entityIds: ["shop-db"] });
  assert.deepEqual(impact.affected.map(item => [item.entityId, item.path]), [["shop-api", ["shop-db", "shop-api"]], ["shop-web", ["shop-db", "shop-api", "shop-web"]]]);
  assert.equal(impact.liveAffected, 2);
  assert.throws(() => catalog.impact({ projectId: P, entityIds: [] }), code("IMPACT_INPUT_INVALID")); assert.throws(() => catalog.impact({ projectId: P, entityIds: ["ghost-entity"] }), code("ENTITY_NOT_FOUND"));
  const center = createCommandCenter({ now, impactFor: (projectId, entityIds) => catalog.impact({ projectId, entityIds }) });
  const command = center.createIntent({ actor: admin, projectId: P, commandId: "cmd-impact", action: "change-settings", risk: "medium", payload: { entityIds: ["shop-db"] }, correlationId: "corr-impact", idempotencyKey: "idem-impact" });
  assert.equal(center.commandCard({ actor: viewer, commandId: command.commandId }).impact.affectedCount, 2);
  assert.equal(createCommandCenter({ now }).commandCard.length, 1);
});

test("BO-097 Git stays canonical: a Notion edit becomes a proposal, a conflict when Git moved, and never overwrites", () => {
  const catalog = seeded();
  const projection = catalog.projection({ projectId: P, entityId: "shop-repo" });
  assert.equal(projection.canonical, "git"); assert.match(projection.canonicalHash, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(catalog.projection({ projectId: P, entityId: "shop-repo" }), projection, "projection is deterministic");
  const edit = fields => catalog.reconcileProjectionEdit({ actor: admin, projectId: P, entityId: "shop-repo", baseVersion: projection.canonicalVersion, baseHash: projection.canonicalHash, editedFields: fields });
  assert.throws(() => edit({ type: "service" }), code("PROJECTION_FIELD_READ_ONLY")); assert.throws(() => edit({ desired: { apiKey: "x" } }), code("SENSITIVE_METADATA_REJECTED"));
  assert.equal(edit({ name: "shop-repo" }).state, "no-change");
  const proposal = edit({ name: "Shop repository" });
  assert.equal(proposal.state, "proposed"); assert.equal(proposal.overwrite, "forbidden");
  assert.equal(catalog.list({ projectId: P, type: "repository" })[0].name, "shop-repo", "the canonical entity did not change");
  assert.throws(() => catalog.decideProjectionProposal({ actor: admin, projectId: P, projectionProposalId: proposal.projectionProposalId, decision: "accept", reason: "ok" }), code("OWNER_REQUIRED"));
  assert.equal(catalog.decideProjectionProposal({ actor: owner, projectId: P, projectionProposalId: proposal.projectionProposalId, decision: "accept", reason: "name is clearer" }).canonicalChange.via, "git-review");
  assert.equal(catalog.list({ projectId: P, type: "repository" })[0].name, "shop-repo", "accepting records a decision; the change still lands through Git");
  assert.throws(() => catalog.decideProjectionProposal({ actor: owner, projectId: P, projectionProposalId: proposal.projectionProposalId, decision: "reject", reason: "late" }), code("PROJECTION_PROPOSAL_CLOSED"));
  catalog.attachReferences({ actor: admin, projectId: P, entityId: "shop-repo", references: { owner: "hero-owner" } });
  const conflict = edit({ name: "Another name" });
  assert.equal(conflict.state, "conflict", "Git moved since the projection was taken"); assert.equal(conflict.canonicalVersion, projection.canonicalVersion + 1);
  assert.throws(() => catalog.decideProjectionProposal({ actor: owner, projectId: P, projectionProposalId: conflict.projectionProposalId, decision: "accept", reason: "force" }), code("PROJECTION_PROPOSAL_CLOSED"), "a conflict cannot be accepted");
  assert.equal(catalog.listProjectionProposals({ projectId: P, state: "conflict" }).length, 1);
});

test("BO-098 catalog rebuild: every record replays in any order to the same state", async () => {
  const catalog = seeded();
  catalog.attachReferences({ actor: admin, projectId: P, entityId: "shop-api", references: { owner: "hero-owner", team: "developero" } });
  catalog.registerKnowledge({ actor: admin, projectId: P, knowledgeId: "decision-a", kind: "decision", title: "Decision A", sourceRef: "hero://docs/a" }); catalog.registerKnowledge({ actor: admin, projectId: P, knowledgeId: "decision-b", kind: "decision", title: "Decision B", sourceRef: "hero://docs/b" });
  catalog.linkKnowledge({ actor: admin, projectId: P, fromKnowledgeId: "decision-b", toKnowledgeId: "decision-a", relation: "supersedes" });
  const projection = catalog.projection({ projectId: P, entityId: "shop-repo" });
  catalog.reconcileProjectionEdit({ actor: admin, projectId: P, entityId: "shop-repo", baseVersion: projection.canonicalVersion, baseHash: projection.canonicalHash, editedFields: { name: "Renamed" } });
  const rows = [];
  const client = { async query(sql, values) {
    if (sql.startsWith("INSERT INTO system_catalog_entities")) rows.push({ table: "e", entity_id: values[0], entity_version: values[1], project_id: values[2], lifecycle: values[4], metadata: JSON.parse(values[5]), actor_id: values[6] });
    else if (sql.startsWith("INSERT INTO system_catalog_records")) rows.push({ table: "r", record_key: values[0], record_version: values[1], project_id: values[2], record_kind: values[3], state: values[4], metadata: JSON.parse(values[5]), actor_id: values[6] });
    else if (sql.includes("FROM system_catalog_entities")) return { rows: rows.filter(row => row.table === "e") }; else return { rows: rows.filter(row => row.table === "r") };
    return { rows: [] };
  } };
  const store = createPostgresSystemCatalogStore({ client });
  for (const record of catalog.drainRecords()) await store.appendRecord(record);
  const records = await store.listRecords();
  const restored = createSystemCatalog({ now }); for (const record of [...records].reverse()) restored.hydrate(record);
  assert.deepEqual(restored.documentGraph({ actor: owner, projectId: P }), catalog.documentGraph({ actor: owner, projectId: P }));
  assert.deepEqual(restored.graph({ projectId: P }), catalog.graph({ projectId: P }));
  assert.deepEqual(restored.projection({ projectId: P, entityId: "shop-api" }), catalog.projection({ projectId: P, entityId: "shop-api" }));
  assert.equal(restored.listProjectionProposals({ projectId: P }).length, 1);
  const again = createSystemCatalog({ now }); for (const record of records) again.hydrate(record);
  assert.deepEqual(again.list({ projectId: P }), restored.list({ projectId: P }), "order does not matter");
  assert.throws(() => restored.linkKnowledge({ actor: admin, projectId: P, fromKnowledgeId: "decision-a", toKnowledgeId: "decision-b", relation: "supersedes" }), code("KNOWLEDGE_CYCLE"), "rules still hold after a rebuild");
});
