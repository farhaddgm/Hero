// A self-contained Hero instance for local audits and tests: real server, real
// domain modules, in-memory persistence, three human roles on one project and a
// second project nobody but the owner can see. No network, no secret, no provider.
import { createProjectSettingsRegistry } from "../../packages/domain/src/project-settings.mjs";
import { createProjectWorkspace } from "../../packages/domain/src/project-workspace.mjs";
import { createHeroServer } from "../../apps/control-plane/src/server.mjs";
import { createHumanIdentity, createTotpCode } from "../../packages/domain/src/human-identity.mjs";
import { createProjectAccessRegistry } from "../../packages/domain/src/project-access.mjs";
import { createOwnerAuth } from "../../packages/domain/src/owner-auth.mjs";

const ownerActor = { subject: "hero-owner", role: "project-owner" };
export const PAGE_SURFACES = Object.freeze(["studio", "control", "collaboration", "catalog", "insights", "inbox", "help"]);

export async function createAuditFixture({ now = () => new Date().toISOString(), projects = ["project-alpha", "project-beta"], serverOptions = {}, grants = null } = {}) {
  const access = createProjectAccessRegistry({ ownerUserId: "hero-owner", ownerUser: { email: "owner@example.test", displayName: "Owner" }, now });
  const identity = createHumanIdentity({ accessRegistry: access, sessionSecret: "audit-fixture-session-secret-1234567890", now, owner: { userId: "hero-owner", email: "owner@example.test", password: "Owner password 123", mfaSecret: "owner-mfa-secret-audit" } });
  const login = (email, password, secret) => { const challenge = identity.beginLogin({ email, password }); return identity.completeLogin({ challengeId: challenge.challengeId, mfaCode: createTotpCode(secret, Math.floor(Date.parse(now()) / 1000)) }).token; };
  const projectSettings = createProjectSettingsRegistry({ now }); const projectWorkspace = createProjectWorkspace({ ownerUserId: "hero-owner", now, settings: projectSettings });
  for (const [userId, email, secret] of [["admin-user", "admin@example.test", "admin-mfa-secret-audit"], ["viewer-user", "viewer@example.test", "viewer-mfa-secret-audit"]]) identity.createUser({ actor: ownerActor, user: { userId, email, displayName: userId, password: "User password 123", mfaSecret: secret, mfaRequired: true } });
  const grantList = grants ?? [{ projectId: projects[0], userId: "admin-user", role: "admin" }, { projectId: projects[0], userId: "viewer-user", role: "viewer" }];
  const app = createHeroServer({ host: "127.0.0.1", port: 0, now, ownerAuth: createOwnerAuth({ secret: "audit-fixture-owner-secret-12345678901234567890", now }), projectAccessRegistry: access, humanIdentity: identity, projectSettings, projectWorkspace, ...serverOptions });
  const address = await app.start(); const base = `http://127.0.0.1:${address.port}`;
  const tokens = { owner: login("owner@example.test", "Owner password 123", "owner-mfa-secret-audit"), admin: login("admin@example.test", "User password 123", "admin-mfa-secret-audit"), viewer: login("viewer@example.test", "User password 123", "viewer-mfa-secret-audit") };
  const call = async (who, method, route, body, headers = {}) => {
    const response = await fetch(`${base}${route}`, { method, headers: { authorization: `Bearer ${tokens[who]}`, "content-type": "application/json", ...(method === "GET" ? {} : { origin: base }), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    const raw = await response.text(); let parsed; try { parsed = JSON.parse(raw); } catch { parsed = raw; } return { status: response.status, body: parsed };
  };
  // Projects are created with the real workspace domain and their Foundation is approved, so policy readiness and dispatch behave as on Test.
  // This happens in-process on purpose: a restarted fixture must not add audited HTTP writes of its own.
  for (const projectId of projects) {
    const created = projectWorkspace.createProject({ actor: ownerActor, projectId, name: projectId, intake: { projectType: "application", riskLevel: "standard" } });
    const proposal = created?.foundationProposal ?? created?.proposal;
    if (proposal) projectWorkspace.approveFoundation({ actor: ownerActor, projectId, proposalId: proposal.proposalId, expectedVersion: proposal.version ?? 1 });
  }
  for (const grant of grantList) access.upsertGrant({ actor: ownerActor, grant });
  const page = async (who, surface, projectId = projects[0], extra = "") => {
    const response = await fetch(`${base}/api/portal?surface=${surface}&projectId=${projectId}${extra}`, { headers: { cookie: `__Host-hero-human-session=${encodeURIComponent(tokens[who])}` }, redirect: "manual" });
    return { status: response.status, html: await response.text(), headers: response.headers };
  };
  /** Gives every page something to render: a command, a decision, usage, a catalog entity and an SLI. */
  async function seed(projectId = projects[0]) {
    const root = `/api/projects/${projectId}`;
    await call("admin", "POST", `${root}/commands`, { commandId: "cmd-fixture-1", action: "deploy.test", risk: "medium", correlationId: "corr-fixture-1", idempotencyKey: "idem-fixture-1" });
    await call("admin", "POST", `${root}/commands/cmd-fixture-1/authorize`, { authorizationSnapshotId: "BATCH-BACKOFFICE-20261007-026" });
    await call("admin", "POST", `${root}/notifications`, { category: "approval", severity: "warning", title: "Approve the fixture deploy", deduplicationKey: "fixture-approve", correlationId: "corr-fixture-1", action: { type: "approve", commandId: "cmd-fixture-1" } });
    await call("admin", "POST", `${root}/notifications`, { category: "health", severity: "critical", title: "Fixture disk almost full", deduplicationKey: "fixture-disk", correlationId: "corr-fixture-2", ownerId: "hero-owner" });
    await call("admin", "POST", `${root}/budget`, { softThreshold: 1000, hardCap: 2000 });
    await call("admin", "POST", `${root}/usage`, { usageId: "usage-fixture-1", invocationId: "invoke-fixture-1", provider: "openai", model: "sol", inputTokens: 120, teamId: "developero" });
    await call("admin", "POST", `${root}/catalog`, { entityId: "fixture-api", type: "service", name: "Fixture API", lifecycle: "active", metadata: { owner: "hero-owner" } });
    await call("admin", "POST", `${root}/slo`, { projection: "portfolio", lagSeconds: 2, freshnessSeconds: 60 });
  }
  return { app, base, tokens, call, page, seed, projects, ownerActor, stop: () => app.stop() };
}
