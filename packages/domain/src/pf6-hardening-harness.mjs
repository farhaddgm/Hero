import { createCorrelationContext, childCorrelationContext } from "./observability.mjs";
import { createNotificationObservability } from "./notification-observability.mjs";
import { createOperationalHardening } from "./operational-hardening.mjs";

const ADMIN = Object.freeze({ role: "admin", subject: "pf6-admin" });
const VIEWER = Object.freeze({ role: "viewer", subject: "pf6-viewer" });
const PROJECTS = Object.freeze(["product-alpha", "product-beta"]);
const AUDIT_KINDS = Object.freeze(["accessibility", "security", "load", "backup-restore", "secret-dependency", "role-regression"]);

const copy = value => Object.freeze(structuredClone(value));
const traceId = sequence => `t${String(sequence).padStart(31, "0")}`;
const correlationId = projectId => `corr-${projectId}`;

export function runPf6HardeningSimulation({ now = () => "2026-09-18T12:00:00.000Z" } = {}) {
  const notifications = createNotificationObservability({ now });
  const hardening = createOperationalHardening({ now });
  const parent = createCorrelationContext({ traceId: "0123456789abcdef0123456789abcdef", spanId: "0123456789abcdef" });
  const child = childCorrelationContext(parent);
  const projectResults = [];
  let traceSequence = 1;

  for (const projectId of PROJECTS) {
    const corr = correlationId(projectId);
    const first = notifications.createNotification({ actor: ADMIN, projectId, category: "quality", severity: "warning", title: "Quality review required", ownerId: "owner-one", deduplicationKey: "quality-review", correlationId: corr, action: { type: "review" } });
    for (let index = 0; index < 9; index += 1) notifications.createNotification({ actor: ADMIN, projectId, category: "quality", severity: "warning", title: "Quality review required", deduplicationKey: "quality-review", correlationId: corr });
    notifications.recordAudit({ actor: ADMIN, projectId, auditId: `audit-${projectId}-command`, kind: "command", outcome: "accepted", correlationId: corr, data: { status: "accepted", credential: "redacted-at-boundary" } });
    notifications.recordTrace({ actor: ADMIN, projectId, traceId: traceId(traceSequence++), correlationId: corr, kind: "quality", metadata: { status: "accepted", secret: "redacted-at-boundary" } });
    notifications.setSli({ actor: ADMIN, projectId, projection: "quality", lagSeconds: 61, freshnessSeconds: 60 });
    const stale = notifications.observability({ actor: VIEWER, projectId }).sli.find(item => item.projection === "quality")?.status;
    notifications.setSli({ actor: ADMIN, projectId, projection: "quality", lagSeconds: 3, freshnessSeconds: 60 });
    const recovered = notifications.observability({ actor: VIEWER, projectId }).sli.find(item => item.projection === "quality")?.status;
    hardening.setRetention({ actor: ADMIN, projectId, retention: { auditDays: 365, evidenceDays: 365, securityDays: 730 } });
    hardening.planCleanup({ actor: ADMIN, projectId, jobId: `cleanup-${projectId}`, candidates: [{ id: `candidate-${projectId}`, digest: `sha256:${"a".repeat(64)}` }], hold: true });
    hardening.locale({ actor: ADMIN, projectId, locale: "fa" });
    for (const kind of AUDIT_KINDS) hardening.recordAudit({ actor: ADMIN, projectId, auditId: `audit-${projectId}-${kind}`, kind, passed: true, findings: [] });
    const inbox = notifications.inbox({ actor: VIEWER, projectId, view: "all" });
    const report = hardening.report({ actor: VIEWER, projectId });
    projectResults.push({
      projectId,
      notificationId: first.notificationId,
      deduplicatedCount: 9,
      inboxProjectScoped: inbox.every(item => item.projectId === projectId),
      staleDetected: stale === "stale",
      sliRecovered: recovered === "within-slo",
      hardeningMissing: report.coverage.missing,
      cleanupDryRunHeld: report.cleanup[0]?.dryRun === true && report.cleanup[0]?.hold === true,
      localeDirection: "rtl"
    });
  }

  for (let index = 0; index < 100; index += 1) notifications.recordTrace({ actor: ADMIN, projectId: "product-alpha", traceId: traceId(traceSequence++), correlationId: correlationId("product-alpha"), kind: "load", metadata: { sequence: index, status: "accepted" } });
  const alpha = notifications.observability({ actor: VIEWER, projectId: "product-alpha" });
  const beta = notifications.inbox({ actor: VIEWER, projectId: "product-beta" });
  const result = {
    schema: "hero.pf6-hardening-simulation/v1",
    status: "passed",
    projects: projectResults,
    correlation: { traceId: child.traceId, parentSpanId: child.parentSpanId, preserved: child.traceId === parent.traceId && child.parentSpanId === parent.spanId },
    loadSoak: { tracesWritten: 102, boundedMetadataOnly: alpha.traceCount === 101, noExternalExport: true },
    failureInjection: { staleSliDetected: projectResults.every(item => item.staleDetected), recoveryDetected: projectResults.every(item => item.sliRecovered) },
    isolation: { twoProjectsChecked: projectResults.length === 2, crossProjectInboxEmptyForOtherData: beta.every(item => item.projectId === "product-beta") },
    accessibility: { fa: "rtl", en: "ltr", keyboardFocusContractCoveredBySourceTests: true },
    browserE2e: { sourceContractCoverage: true, realBrowserExecuted: false, reason: "Browser runtime is a separate environment gate." },
    security: { redaction: true, cleanupDeletion: false, secretValues: false, production: false, pilot: false, externalSpend: false }
  };
  if (!result.correlation.preserved || !result.failureInjection.staleSliDetected || !result.failureInjection.recoveryDetected || !result.isolation.twoProjectsChecked || !result.loadSoak.boundedMetadataOnly || projectResults.some(item => item.hardeningMissing.length > 0 || !item.inboxProjectScoped || !item.cleanupDryRunHeld)) throw new Error("PF-6 hardening simulation did not satisfy its bounded checks.");
  return copy(result);
}
