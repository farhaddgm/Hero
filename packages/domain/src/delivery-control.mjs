import { createHash } from "node:crypto";
import {
  BREAK_GLASS_MAX_SECONDS, DELIVERY_RELEASE_STATES, DELIVERY_TARGETS, RECOVERY_ORDER, RELEASE_TRANSITIONS,
  TELEMETRY_FIELDS, TELEMETRY_HEALTH_STATES, TELEMETRY_KINDS, TELEMETRY_LOG_LEVELS, TELEMETRY_MESSAGE_MAX, TELEMETRY_METRIC_UNITS
} from "../../contracts/src/delivery-control.mjs";

const ID = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;
const INTERNAL_REF = /^hero:\/\/[A-Za-z0-9._~:/?#@!$&'()*+,;=%-]{2,300}$/;
const COMMIT = /^[a-f0-9]{7,64}$/i;
const DIGEST = /^sha256:[a-f0-9]{64}$/i;
const NAME = /^[a-z][a-z0-9._-]{1,63}$/;
const RECORD_KINDS = Object.freeze(["telemetry", "break-glass", "release", "artifact", "matrix", "bundle", "portability", "rehearsal", "acceptance"]);
const TELEMETRY_PER_HOUR = 1000;

const copy = value => Object.freeze(structuredClone(value));
const sha256 = value => createHash("sha256").update(value).digest("hex");
const canonical = value => (Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value);

export class DeliveryError extends Error {
  constructor(code, message, statusCode = 409) { super(message); this.name = "DeliveryError"; this.code = code; this.statusCode = statusCode; }
}
const fail = (code, message, statusCode = 409) => { throw new DeliveryError(code, message, statusCode); };
const id = (label, value) => { if (typeof value !== "string" || !ID.test(value)) fail("INVALID_IDENTIFIER", `${label} is invalid.`, 400); return value; };
const write = actor => { if (!actor || !["project-owner", "admin"].includes(actor.role)) fail("PROJECT_WRITE_REQUIRED", "Project owner or admin access is required.", 403); return actor; };
const ownerOnly = actor => { if (!actor || actor.role !== "project-owner") fail("OWNER_REQUIRED", "Only the owner may do this.", 403); return actor; };
const read = actor => { if (!actor || !["project-owner", "admin", "viewer"].includes(actor.role)) fail("PROJECT_READ_REQUIRED", "Project access is required.", 403); return actor; };
const internalRef = (label, value) => { if (typeof value !== "string" || !INTERNAL_REF.test(value)) fail("INTERNAL_REFERENCE_REQUIRED", `${label} must be an internal hero:// reference.`, 400); return value; };

/** BO-135: what a log line may still say after redaction. */
export function redactTelemetryText(value) {
  return String(value)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]")
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[ip]")
    .replace(/\b(?:bearer|basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, "[credential]")
    .replace(/\b[A-Fa-f0-9]{24,}\b|\b[A-Za-z0-9+/_-]{32,}={0,2}/g, "[token]")
    .replace(/\+?\d[\d\s().-]{8,}\d/g, "[number]")
    .slice(0, TELEMETRY_MESSAGE_MAX);
}

function validateTelemetry(kind, metadata) {
  const reject = () => fail("TELEMETRY_REJECTED", "Only allowlisted and sanitized Production telemetry is accepted.", 400);
  if (!TELEMETRY_KINDS.includes(kind) || !metadata || typeof metadata !== "object" || Array.isArray(metadata)) reject();
  const keys = Object.keys(metadata);
  if (keys.length !== TELEMETRY_FIELDS[kind].length || keys.some(key => !TELEMETRY_FIELDS[kind].includes(key))) reject();
  const text = (value, pattern) => typeof value === "string" && pattern.test(value);
  if (kind === "health") { if (!text(metadata.component, NAME) || !TELEMETRY_HEALTH_STATES.includes(metadata.status)) reject(); return { component: metadata.component, status: metadata.status }; }
  if (kind === "metric") { if (!text(metadata.name, NAME) || !Number.isFinite(metadata.value) || Math.abs(metadata.value) > 1e12 || !TELEMETRY_METRIC_UNITS.includes(metadata.unit)) reject(); return { name: metadata.name, value: metadata.value, unit: metadata.unit }; }
  if (kind === "sanitized-log") { if (!TELEMETRY_LOG_LEVELS.includes(metadata.level) || !text(metadata.code, /^[A-Z][A-Z0-9_]{2,63}$/) || typeof metadata.message !== "string" || metadata.message.length > 2000) reject(); return { level: metadata.level, code: metadata.code, message: redactTelemetryText(metadata.message) }; }
  if (!text(metadata.traceId, /^[a-f0-9]{16,32}$/) || !Number.isInteger(metadata.spanCount) || metadata.spanCount < 0 || metadata.spanCount > 100_000 || !Number.isFinite(metadata.durationMs) || metadata.durationMs < 0 || metadata.durationMs > 86_400_000 || !["ok", "error"].includes(metadata.status)) reject();
  return { traceId: metadata.traceId, spanCount: metadata.spanCount, durationMs: metadata.durationMs, status: metadata.status };
}

/**
 * Production privacy, release and delivery bundle (WP-12).
 *
 * Hero records and verifies; it never deploys, never exports and never reads Production data.
 * State is an append-only record stream (outbox -> table -> order-independent hydrate).
 */
export function createDeliveryControl({ now = () => new Date().toISOString() } = {}) {
  const telemetry = new Map(); const breakGlass = new Map(); const releases = new Map(); const artifacts = new Map(); const matrices = new Map();
  const bundles = new Map(); const portability = new Map(); const rehearsals = new Map(); const acceptance = new Map();
  const outbox = []; const versions = new Map(); const seen = new Map(); const nowMs = () => Date.parse(now());

  const emit = (kind, key, projectId, payload, actorId, version) => {
    const mark = `${kind}:${key}`; const finalVersion = version ?? (versions.get(mark) ?? 0) + 1; versions.set(mark, Math.max(versions.get(mark) ?? 0, finalVersion));
    outbox.push(copy({ kind, key, version: finalVersion, projectId, actorId: actorId ?? "hero-system", recordedAt: now(), payload }));
  };
  const get = (map, key, projectId, code) => { const item = map.get(key); if (!item || item.projectId !== projectId) fail(code, "Record was not found in this project.", 404); return item; };
  const mine = (map, projectId) => [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value).filter(item => item.projectId === projectId);
  const grantLive = item => (item.state === "approved" && Date.parse(item.grantedUntil) <= nowMs() ? "expired" : item.state);

  const api = {
    // ------------------------------------------------------------ BO-135 / BO-136 telemetry
    ingestTelemetry({ actor, projectId, telemetryId, kind, metadata }) {
      write(actor); id("projectId", projectId); id("telemetryId", telemetryId);
      const clean = validateTelemetry(kind, metadata);
      const existing = telemetry.get(telemetryId);
      if (existing) { if (existing.projectId === projectId && JSON.stringify(canonical(existing.metadata)) === JSON.stringify(canonical(clean)) && existing.kind === kind) return existing; fail("TELEMETRY_ID_CONFLICT", "This telemetry id was used for different content.", 409); }
      const lastHour = [...telemetry.values()].filter(item => item.projectId === projectId && nowMs() - Date.parse(item.recordedAt) < 3600_000).length;
      if (lastHour >= TELEMETRY_PER_HOUR) fail("TELEMETRY_RATE_LIMITED", "Too much telemetry in the last hour for this project.", 429);
      const item = copy({ projectId, telemetryId, kind, metadata: clean, payload: "forbidden", recordedAt: now(), recordedBy: actor.subject });
      telemetry.set(telemetryId, item); emit("telemetry", telemetryId, projectId, { telemetry: item }, actor.subject, 1); return item;
    },

    // ------------------------------------------------------------ BO-137 break-glass
    requestBreakGlass({ actor, projectId, requestId, scope, reason, expiresAt }) {
      ownerOnly(actor); id("projectId", projectId); id("requestId", requestId);
      const expiry = Date.parse(expiresAt);
      if (typeof scope !== "string" || scope.trim().length < 3 || typeof reason !== "string" || reason.trim().length < 8 || !Number.isFinite(expiry) || expiry <= nowMs() || expiry > nowMs() + BREAK_GLASS_MAX_SECONDS * 1000) fail("BREAK_GLASS_INVALID", `Scope, reason and a future expiry within ${BREAK_GLASS_MAX_SECONDS / 3600} hours are required.`, 400);
      if (breakGlass.has(requestId)) fail("BREAK_GLASS_EXISTS", "This request already exists.");
      const item = copy({ projectId, requestId, scope: scope.slice(0, 160), reason: reason.slice(0, 500), requestedUntil: new Date(expiry).toISOString(), expiresAt: new Date(expiry).toISOString(), state: "approval-required", dataAccess: "not-granted-by-hero", approvedBy: null, requestedAt: now(), requestedBy: actor.subject, audit: true });
      breakGlass.set(requestId, item); emit("break-glass", requestId, projectId, { request: item }, actor.subject, 1); return item;
    },
    /** A different person approves. The approval is a time-boxed record; Hero still grants no data access. */
    decideBreakGlass({ actor, projectId, requestId, decision, durationSeconds }) {
      write(actor);
      const prior = get(breakGlass, id("requestId", requestId), projectId, "BREAK_GLASS_NOT_FOUND");
      if (!["approve", "deny"].includes(decision)) fail("BREAK_GLASS_DECISION_INVALID", "Decision must be approve or deny.", 400);
      if (prior.state !== "approval-required") fail("BREAK_GLASS_NOT_PENDING", "Only a pending request can be decided.", 409);
      if (Date.parse(prior.requestedUntil) <= nowMs()) fail("BREAK_GLASS_EXPIRED", "The request expired before it was decided.", 409);
      if (actor.subject === prior.requestedBy) fail("BREAK_GLASS_SELF_APPROVAL", "The person who asked cannot decide the request.", 403);
      if (decision === "deny") { const denied = copy({ ...prior, state: "denied", decidedAt: now(), decidedBy: actor.subject }); breakGlass.set(requestId, denied); emit("break-glass", requestId, projectId, { request: denied }, actor.subject, 2); return denied; }
      const seconds = durationSeconds === undefined ? BREAK_GLASS_MAX_SECONDS : durationSeconds;
      if (!Number.isInteger(seconds) || seconds < 60 || seconds > BREAK_GLASS_MAX_SECONDS) fail("BREAK_GLASS_DURATION_INVALID", `Duration must be between 60 seconds and ${BREAK_GLASS_MAX_SECONDS / 3600} hours.`, 400);
      const until = new Date(Math.min(Date.parse(prior.requestedUntil), nowMs() + seconds * 1000)).toISOString();
      const approved = copy({ ...prior, state: "approved", approvedBy: actor.subject, decidedAt: now(), decidedBy: actor.subject, grantedUntil: until });
      breakGlass.set(requestId, approved); emit("break-glass", requestId, projectId, { request: approved }, actor.subject, 2); return approved;
    },
    revokeBreakGlass({ actor, projectId, requestId, reason }) {
      ownerOnly(actor);
      const prior = get(breakGlass, id("requestId", requestId), projectId, "BREAK_GLASS_NOT_FOUND");
      if (!["approval-required", "approved"].includes(prior.state)) fail("BREAK_GLASS_NOT_ACTIVE", "Only a pending or approved request can be revoked.", 409);
      const next = copy({ ...prior, state: "revoked", revokedAt: now(), revokedBy: actor.subject, revokeReason: String(reason ?? "").slice(0, 500) });
      breakGlass.set(requestId, next); emit("break-glass", requestId, projectId, { request: next }, actor.subject, 3); return next;
    },

    // ------------------------------------------------------------ BO-139 releases
    createRelease({ actor, projectId, releaseId, testedCommit, artifactId }) {
      write(actor); id("releaseId", releaseId);
      if (typeof testedCommit !== "string" || !COMMIT.test(testedCommit)) fail("COMMIT_INVALID", "A tested Git commit is required.", 400);
      if (releases.has(releaseId)) fail("RELEASE_EXISTS", "This release already exists.");
      if (artifactId !== undefined) get(artifacts, id("artifactId", artifactId), projectId, "ARTIFACT_NOT_FOUND");
      const item = copy({ projectId, releaseId, testedCommit: testedCommit.toLowerCase(), artifactId: artifactId ?? null, state: "tested", history: [{ state: "tested", at: now(), by: actor.subject }], deploy: "not-executed" });
      releases.set(releaseId, item); emit("release", releaseId, projectId, { release: item }, actor.subject, 1); return item;
    },
    transitionRelease({ actor, projectId, releaseId, state, reason = "", evidenceRef, artifactId }) {
      write(actor);
      const prior = get(releases, id("releaseId", releaseId), projectId, "RELEASE_NOT_FOUND");
      if (!DELIVERY_RELEASE_STATES.includes(state) || !(RELEASE_TRANSITIONS[prior.state] ?? []).includes(state)) fail("RELEASE_TRANSITION_INVALID", "Release transition is not allowed.", 409);
      let attached = prior.artifactId;
      if (artifactId !== undefined) { get(artifacts, id("artifactId", artifactId), projectId, "ARTIFACT_NOT_FOUND"); attached = artifactId; }
      if (state === "ready" && !attached) fail("RELEASE_ARTIFACT_REQUIRED", "A registered artifact with a digest must be attached before a release is ready.", 409);
      if (state === "deployed") internalRef("evidenceRef", evidenceRef);
      if (["rolled-back", "blocked"].includes(state) && String(reason).trim().length < 8) fail("RELEASE_REASON_REQUIRED", "A reason of at least 8 characters is required.", 400);
      const next = copy({
        ...prior, artifactId: attached, state,
        history: [...prior.history, { state, at: now(), by: actor.subject, reason: String(reason).slice(0, 500), ...(state === "deployed" ? { evidenceRef } : {}) }],
        deploy: state === "deployed" ? "record-only-separate-dispatch-required" : prior.deploy
      });
      releases.set(releaseId, next); emit("release", releaseId, projectId, { release: next }, actor.subject, next.history.length); return next;
    },

    // ------------------------------------------------------------ BO-140 artifacts
    registerArtifact({ actor, projectId, artifactId, digest, provenance, attestationRef, sbomRef }) {
      write(actor); id("artifactId", artifactId);
      if (typeof digest !== "string" || !DIGEST.test(digest)) fail("ARTIFACT_INVALID", "Digest and internal provenance, attestation and SBOM references are required.", 400);
      for (const [label, value] of [["provenance", provenance], ["attestationRef", attestationRef], ["sbomRef", sbomRef]]) if (typeof value !== "string" || !INTERNAL_REF.test(value)) fail("ARTIFACT_INVALID", "Digest and internal provenance, attestation and SBOM references are required.", 400);
      const prior = artifacts.get(artifactId);
      if (prior) {
        if (prior.projectId !== projectId) fail("ARTIFACT_CROSS_PROJECT", "This artifact id belongs to another project.", 409);
        if (prior.digest !== digest.toLowerCase()) fail("ARTIFACT_IMMUTABLE", "A registered artifact cannot change its digest; register a new artifact.", 409);
        return prior;
      }
      const item = copy({ projectId, artifactId, digest: digest.toLowerCase(), provenance, attestationRef, sbomRef, registeredAt: now(), registeredBy: actor.subject });
      artifacts.set(artifactId, item); emit("artifact", artifactId, projectId, { artifact: item }, actor.subject, 1); return item;
    },

    // ------------------------------------------------------------ BO-141 matrix
    deliveryMatrix({ actor, projectId, targets }) {
      write(actor);
      const entries = Object.entries(targets ?? {});
      if (!entries.length || entries.some(([target, artifactId]) => !DELIVERY_TARGETS.includes(target) || !artifacts.get(String(artifactId)) || artifacts.get(String(artifactId)).projectId !== projectId)) fail("DELIVERY_MATRIX_INVALID", "Every target requires a registered project artifact.", 400);
      const version = (versions.get(`matrix:${projectId}`) ?? 0) + 1;
      const item = copy({ projectId, targets: Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b))), version, createdAt: now(), createdBy: actor.subject });
      matrices.set(projectId, item); emit("matrix", projectId, projectId, { matrix: item }, actor.subject, version); return item;
    },

    // ------------------------------------------------------------ BO-142 bundle
    createBundle({ actor, projectId, bundleId, artifactIds, sourceRef, configRef, migrationRef, deployRef, docsRef, reportsRef }) {
      write(actor); id("bundleId", bundleId);
      const refs = { sourceRef, configRef, migrationRef, deployRef, docsRef, reportsRef };
      if (!Array.isArray(artifactIds) || !artifactIds.length || artifactIds.some(value => !artifacts.get(String(value)) || artifacts.get(String(value)).projectId !== projectId) || Object.values(refs).some(value => typeof value !== "string" || !INTERNAL_REF.test(value))) fail("BUNDLE_INVALID", "Bundle must contain registered artifacts and internal, secret-free references.", 400);
      if (bundles.has(bundleId)) fail("BUNDLE_EXISTS", "A bundle is immutable; create a new bundle id.");
      const ordered = [...new Set(artifactIds.map(String))].sort();
      const manifest = { projectId, bundleId, artifacts: ordered.map(artifactId => ({ artifactId, digest: artifacts.get(artifactId).digest })), ...refs };
      const manifestDigest = `sha256:${sha256(JSON.stringify(canonical(manifest)))}`;
      const item = copy({ projectId, bundleId, artifactIds: ordered, ...refs, manifest, manifestDigest, state: "manifest-only-no-export", createdAt: now(), createdBy: actor.subject });
      bundles.set(bundleId, item); emit("bundle", bundleId, projectId, { bundle: item }, actor.subject, 1); return item;
    },

    // ------------------------------------------------------------ BO-143 portability
    /** The target reports the digest of the manifest it received. Hero compares; the caller cannot just claim "passed". */
    verifyPortability({ actor, projectId, bundleId, targetId, observedManifestDigest, result }) {
      write(actor);
      const bundle = get(bundles, id("bundleId", bundleId), projectId, "BUNDLE_NOT_FOUND"); id("targetId", targetId);
      if (typeof observedManifestDigest !== "string" || !DIGEST.test(observedManifestDigest)) fail("PORTABILITY_EVIDENCE_REQUIRED", "The target's observed manifest digest is required; a bare result is not evidence.", 400);
      if (result !== undefined && !["passed", "failed"].includes(result)) fail("PORTABILITY_INVALID", "Portability result is invalid.", 400);
      const verdict = observedManifestDigest.toLowerCase() === bundle.manifestDigest ? "passed" : "failed";
      const key = `${bundleId}:${targetId}`; const version = (versions.get(`portability:${key}`) ?? 0) + 1;
      const item = copy({ projectId, bundleId, targetId, result: verdict, expectedManifestDigest: bundle.manifestDigest, observedManifestDigest: observedManifestDigest.toLowerCase(), mode: "target-reported-digest-compared", recordedAt: now(), recordedBy: actor.subject });
      portability.set(key, item); emit("portability", key, projectId, { portability: item }, actor.subject, version); return item;
    },

    // ------------------------------------------------------------ BO-144 rehearsals
    rehearseRecovery({ actor, projectId, bundleId, kind, result, evidenceRef }) {
      write(actor); get(bundles, id("bundleId", bundleId), projectId, "BUNDLE_NOT_FOUND");
      if (!RECOVERY_ORDER.includes(kind) || !["passed", "failed"].includes(result) || typeof evidenceRef !== "string" || !INTERNAL_REF.test(evidenceRef)) fail("REHEARSAL_INVALID", "Recovery rehearsal is invalid.", 400);
      const position = RECOVERY_ORDER.indexOf(kind);
      if (position > 0 && rehearsals.get(`${bundleId}:${RECOVERY_ORDER[position - 1]}`)?.result !== "passed") fail("REHEARSAL_ORDER", `${RECOVERY_ORDER[position - 1]} must pass before ${kind}.`, 409);
      const key = `${bundleId}:${kind}`; const version = (versions.get(`rehearsal:${key}`) ?? 0) + 1;
      const item = copy({ projectId, bundleId, kind, result, evidenceRef, mode: "rehearsal-evidence-only", recordedAt: now(), recordedBy: actor.subject });
      rehearsals.set(key, item); emit("rehearsal", key, projectId, { rehearsal: item }, actor.subject, version); return item;
    },

    // ------------------------------------------------------------ BO-145 acceptance
    accept({ actor, projectId, acceptanceId, bundleId, artifactIdentity, exceptions = [] }) {
      write(actor); id("acceptanceId", acceptanceId);
      const bundle = get(bundles, id("bundleId", bundleId), projectId, "BUNDLE_NOT_FOUND");
      if (acceptance.has(acceptanceId)) fail("ACCEPTANCE_IMMUTABLE", "An acceptance record cannot be rewritten.", 409);
      if (typeof artifactIdentity !== "string" || artifactIdentity.toLowerCase() !== bundle.manifestDigest) fail("ARTIFACT_IDENTITY_MISMATCH", "The artifact identity must be this bundle's manifest digest.", 409);
      const passed = [...portability.values()].some(item => item.bundleId === bundleId && item.result === "passed" && item.expectedManifestDigest === bundle.manifestDigest);
      if (!passed) fail("PORTABILITY_REQUIRED", "A passing portability verification is required.", 409);
      const listed = new Set((Array.isArray(exceptions) ? exceptions : []).map(String));
      const missing = RECOVERY_ORDER.filter(kind => rehearsals.get(`${bundleId}:${kind}`)?.result !== "passed" && !listed.has(`rehearsal:${kind}`));
      if (missing.length) fail("REHEARSAL_REQUIRED", `Each recovery rehearsal must pass or be listed as an exception; missing: ${missing.join(", ")}.`, 409);
      const item = copy({ projectId, acceptanceId, bundleId, artifactIdentity: bundle.manifestDigest, exceptions: [...listed].map(value => value.slice(0, 300)).slice(0, 50), acceptedAt: now(), acceptedBy: actor.subject, delivery: "accepted-not-deployed" });
      acceptance.set(acceptanceId, item); emit("acceptance", acceptanceId, projectId, { acceptance: item }, actor.subject, 1); return item;
    },

    view({ actor, projectId }) {
      read(actor);
      return copy({
        telemetry: mine(telemetry, projectId).slice(-200),
        breakGlass: mine(breakGlass, projectId).map(item => ({ ...item, liveState: grantLive(item) })),
        releases: mine(releases, projectId), artifacts: mine(artifacts, projectId), matrix: matrices.get(projectId) ?? null,
        bundles: mine(bundles, projectId), portability: mine(portability, projectId), rehearsals: mine(rehearsals, projectId),
        acceptance: mine(acceptance, projectId)
      });
    },

    drainRecords() { return Object.freeze(outbox.splice(0, outbox.length)); },
    hydrate(record) {
      if (!record || !RECORD_KINDS.includes(record.kind)) fail("INVALID_HYDRATION", "Delivery record is invalid.", 500);
      const mark = `${record.kind}:${record.key}`; const last = seen.get(mark) ?? 0; if (record.version < last) return; seen.set(mark, record.version); versions.set(mark, Math.max(versions.get(mark) ?? 0, record.version));
      const data = record.payload ?? {};
      const targets = { telemetry: [telemetry, "telemetry"], "break-glass": [breakGlass, "request"], release: [releases, "release"], artifact: [artifacts, "artifact"], matrix: [matrices, "matrix"], bundle: [bundles, "bundle"], portability: [portability, "portability"], rehearsal: [rehearsals, "rehearsal"], acceptance: [acceptance, "acceptance"] };
      const [map, field] = targets[record.kind];
      map.set(record.kind === "telemetry" ? data.telemetry.telemetryId : record.key, copy(data[field]));
    }
  };
  return Object.freeze(api);
}
