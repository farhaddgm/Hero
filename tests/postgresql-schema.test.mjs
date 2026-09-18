import assert from "node:assert/strict";
import test from "node:test";

import {
  POSTGRES_MIGRATIONS,
  POSTGRES_TABLES,
  createPostgresMigrationRunner,
  readPostgresMigration,
  validatePostgresSchemaContract
} from "../packages/adapters/src/postgresql-schema.mjs";

test("PostgreSQL schema contract covers append-only audit and release boundaries", () => {
  assert.deepEqual(validatePostgresSchemaContract(), []);
  assert.deepEqual(POSTGRES_TABLES, [
    "projects",
    "events",
    "principles",
    "principle_reviews",
    "releases",
    "release_evidence",
    "outbox",
    "ai_providers",
    "ai_credentials",
    "ai_models",
    "prompt_versions",
    "agent_profiles",
    "project_agent_bindings",
    "context_snapshots",
    "ai_invocations",
    "evaluations",
    "evaluation_findings",
    "decision_proposals",
    "provider_health_checks",
    "organization_performance_reviews",
    "organization_performance_metrics",
    "ai_benchmark_runs",
    "ai_benchmark_results",
    "domain_registry_snapshots",
    "owner_session_revocations",
    "read_model_access_audit",
    "pricing_catalogs",
    "pricing_catalog_entries",
    "pricing_catalog_activations",
    "notion_document_mappings",
    "backoffice_entity_versions",
    "backoffice_event_envelopes",
    "backoffice_inbox_receipts",
    "backoffice_outbox",
    "backoffice_read_model_snapshots",
    "human_users",
    "project_grant_versions",
    "human_session_revocations",
    "human_identity_audit",
    "project_registry_versions",
    "project_input_metadata",
    "foundation_proposal_versions",
    "project_setting_versions",
    "project_import_plans",
    "product_request_versions",
    "product_runtime_reservations",
    "smart_tester_error_documents",
    "collaboration_records",
    "command_decision_records",
    "approval_records",
    "system_catalog_entities",
    "system_catalog_dependencies",
    "usage_events",
    "evaluation_records",
    "health_records",
    "notification_records",
    "observability_audit_records",
    "catalog_drift_proposals",
    "infrastructure_control_records",
    "delivery_control_records",
    "hardening_control_records",
    "final_readiness_records"
  ]);
  const sql = readPostgresMigration("001");
  assert.match(sql, /sequence bigint GENERATED ALWAYS AS IDENTITY/);
  assert.match(sql, /UNIQUE \(aggregate_type, aggregate_id, aggregate_version\)/);
  assert.match(sql, /hero_reject_append_only_mutation/);
  assert.match(sql, /production_authorization_reference/);
  const aiSql = readPostgresMigration("002");
  assert.match(aiSql, /CREATE TABLE IF NOT EXISTS agent_profiles/);
  assert.match(aiSql, /credential_ref text NOT NULL CHECK/);
  assert.match(aiSql, /authorization_created boolean NOT NULL DEFAULT false CHECK \(authorization_created = false\)/);
  assert.match(aiSql, /context_snapshots_append_only_guard/);
  const reliabilitySql = readPostgresMigration("003");
  assert.match(reliabilitySql, /ADD COLUMN IF NOT EXISTS max_cost_units/);
  assert.match(reliabilitySql, /team_count integer NOT NULL CHECK \(team_count = 11\)/);
  assert.match(reliabilitySql, /mode text NOT NULL CHECK \(mode = 'synthetic-deterministic'\)/);
  const snapshotSql = readPostgresMigration("004");
  assert.match(snapshotSql, /CREATE TABLE IF NOT EXISTS domain_registry_snapshots/);
  assert.match(snapshotSql, /domain_registry_snapshots_append_only_guard/);
  const operationsSql = readPostgresMigration("005");
  assert.match(operationsSql, /CREATE TABLE IF NOT EXISTS owner_session_revocations/);
  assert.match(operationsSql, /ADD COLUMN IF NOT EXISTS attempt_count/);
  assert.match(operationsSql, /owner_session_revocations_append_only_guard/);
  const accessAuditSql = readPostgresMigration("006");
  assert.match(accessAuditSql, /CREATE TABLE IF NOT EXISTS read_model_access_audit/);
  assert.match(accessAuditSql, /read_model_access_audit_append_only_guard/);
  const pricingCatalogSql = readPostgresMigration("007");
  assert.match(pricingCatalogSql, /CREATE TABLE IF NOT EXISTS pricing_catalogs/);
  assert.match(pricingCatalogSql, /CREATE TABLE IF NOT EXISTS pricing_catalog_entries/);
  assert.match(pricingCatalogSql, /pricing_catalog_activations_append_only_guard/);
  const notionSql = readPostgresMigration("008");
  assert.match(notionSql, /CREATE TABLE IF NOT EXISTS notion_document_mappings/);
  assert.match(notionSql, /sync_state text NOT NULL/);
  const foundationSql = readPostgresMigration("009");
  assert.match(foundationSql, /CREATE TABLE IF NOT EXISTS backoffice_entity_versions/);
  assert.match(foundationSql, /CREATE TABLE IF NOT EXISTS backoffice_event_envelopes/);
  assert.match(foundationSql, /backoffice_inbox_receipts_append_only_guard/);
  assert.match(foundationSql, /CREATE TABLE IF NOT EXISTS backoffice_outbox/);
  assert.match(foundationSql, /backoffice_read_model_snapshots_append_only_guard/);
  const identitySql = readPostgresMigration("010");
  assert.match(identitySql, /CREATE TABLE IF NOT EXISTS human_users/);
  assert.match(identitySql, /mfa_secret_ref text/);
  assert.match(identitySql, /CREATE TABLE IF NOT EXISTS project_grant_versions/);
  assert.match(identitySql, /human_identity_audit_append_only_guard/);
  const workspaceSql = readPostgresMigration("011");
  assert.match(workspaceSql, /CREATE TABLE IF NOT EXISTS project_registry_versions/);
  assert.match(workspaceSql, /CREATE TABLE IF NOT EXISTS project_input_metadata/);
  assert.match(workspaceSql, /project_setting_versions_append_only_guard/);
  const collaborationSql = readPostgresMigration("012");
  assert.match(collaborationSql, /CREATE TABLE IF NOT EXISTS collaboration_records/);
  assert.match(collaborationSql, /CREATE TABLE IF NOT EXISTS command_decision_records/);
  assert.match(collaborationSql, /system_catalog_entities_append_only_guard/);
  const intelligenceSql = readPostgresMigration("013");
  assert.match(intelligenceSql, /CREATE TABLE IF NOT EXISTS usage_events/);
  assert.match(intelligenceSql, /CREATE TABLE IF NOT EXISTS notification_records/);
  assert.match(intelligenceSql, /observability_audit_records_append_only_guard/);
  const deliveryHardeningSql = readPostgresMigration("014");
  assert.match(deliveryHardeningSql, /CREATE TABLE IF NOT EXISTS infrastructure_control_records/);
  assert.match(deliveryHardeningSql, /CREATE TABLE IF NOT EXISTS final_readiness_records/);
  assert.match(deliveryHardeningSql, /final_readiness_records_append_only_guard/);
  const smartTesterSql = readPostgresMigration("015");
  assert.match(smartTesterSql, /CREATE TABLE IF NOT EXISTS smart_tester_error_documents/);
  const aiCredentialAuditSql = readPostgresMigration("016");
  assert.match(aiCredentialAuditSql, /human_identity_audit_event_type_check/);
  assert.match(aiCredentialAuditSql, /ai\.credential-stored/);
  assert.match(aiCredentialAuditSql, /ai\.credential-health-checked/);
  assert.match(smartTesterSql, /smart_tester_error_documents_append_only_guard/);
  const productRuntimeReservationSql = readPostgresMigration("018");
  assert.match(productRuntimeReservationSql, /CREATE TABLE IF NOT EXISTS product_runtime_reservations/);
  assert.match(productRuntimeReservationSql, /plan_fingerprint text NOT NULL/);
  assert.match(productRuntimeReservationSql, /UNIQUE \(project_id, run_id\)/);
});

test("PostgreSQL migration runner is transaction-bound and requires an injected client", async () => {
  const queries = [];
  const client = {
    async query(query) {
      queries.push(query);
      return { rowCount: 0 };
    }
  };
  const result = await createPostgresMigrationRunner({ client }).migrate();
  assert.deepEqual(result.applied, POSTGRES_MIGRATIONS.map(migration => migration.id));
  assert.equal(queries[0], "BEGIN");
  assert.match(queries[1], /CREATE TABLE IF NOT EXISTS events/);
  assert.equal(queries.at(-1), "COMMIT");
  assert.throws(() => createPostgresMigrationRunner(), /injected client\.query/);
});

test("PostgreSQL migration runner rolls back when a migration fails", async () => {
  const queries = [];
  const client = {
    async query(query) {
      queries.push(query);
      if (query !== "BEGIN" && query !== "ROLLBACK") throw new Error("database unavailable");
      return { rowCount: 0 };
    }
  };
  await assert.rejects(() => createPostgresMigrationRunner({ client }).migrate(), /database unavailable/);
  assert.deepEqual(queries, ["BEGIN", readPostgresMigration("001"), "ROLLBACK"]);
});
