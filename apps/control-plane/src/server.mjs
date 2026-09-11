import http from "node:http";
import crypto from "node:crypto";
import { timingSafeEqual } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  HERO_SERVICE,
  HERO_VERSION,
  getAuthorizationContractSummary,
  getAssuranceGateContractSummary,
  getAiOrchestrationContractSummary,
  getAiBenchmarkContractSummary,
  getOrganizationAdvisorContractSummary,
  getSkillContractSummary,
  getClaudeReviewContractSummary,
  getCursorHandoffContractSummary,
  getCriticalPrinciplesContractSummary,
  getFakeAgentContractSummary,
  getMobileFactoryContractSummary,
  getOperationalDataSummary,
  getOwnerAuthContractSummary,
  getAdminAuthContractSummary,
  getPortabilityGateContractSummary,
  getPlannerContractSummary,
  getQualityGateContractSummary,
  getReleaseContractSummary,
  getProjectMemoryContractSummary,
  getProviderAgentContractSummary,
  getPublicArchitectureSummary,
  getRunnerContractSummary,
  getTeamContractSummary,
  getTrainingContractSummary,
  getTeamResearchContractSummary,
  getOutputAdvisoryContractSummary,
  getOrganizationPerformanceContractSummary,
  getObservabilityContractSummary,
  getPilotContractSummary,
  projectOperationalEvent,
  getWebFactoryContractSummary,
  getWorkflowContractSummary,
  getProductDevelopmentContractSummary,
  getProjectIdentityContractSummary,
  getProjectSettingsContractSummary,
  getProjectWorkspaceContractSummary,
  getBackofficeCollaborationContractSummary,
  getBackofficeCommandCenterContractSummary,
  getSystemCatalogContractSummary,
  getPerformanceIntelligenceContractSummary,
  getNotificationObservabilityContractSummary,
  getInfrastructureControlContractSummary,
  getDeliveryControlContractSummary,
  getOperationalHardeningContractSummary,
  getFinalReadinessContractSummary
} from "../../../packages/contracts/src/index.mjs";
import { DashboardCommandError, createControlDashboard } from "./dashboard-service.mjs";
import { getDashboardHtml } from "./dashboard-view.mjs";
import { getBackofficeHtml } from "./backoffice-view.mjs";
import { getProductStudioHtml } from "./product-studio-view.mjs";
import { getPortfolioHtml } from "./portfolio-view.mjs";
import { getIdentityHtml } from "./identity-view.mjs";
import { OwnerAuthError, createOwnerAuth } from "../../../packages/domain/src/owner-auth.mjs";
import { AdminAuthError, createAdminAuth } from "../../../packages/domain/src/admin-auth.mjs";
import { createHumanIdentity, HumanIdentityError } from "../../../packages/domain/src/human-identity.mjs";
import { createProjectAccessMiddleware } from "../../../packages/domain/src/project-access-middleware.mjs";
import { createProjectAccessRegistry, ProjectAccessError } from "../../../packages/domain/src/project-access.mjs";
import { createProjectSettingsRegistry, ProjectSettingsError } from "../../../packages/domain/src/project-settings.mjs";
import { createProjectWorkspace, ProjectWorkspaceError } from "../../../packages/domain/src/project-workspace.mjs";
import { createProjectCollaboration, CollaborationError } from "../../../packages/domain/src/project-collaboration.mjs";
import { createCommandCenter, CommandCenterError } from "../../../packages/domain/src/command-center.mjs";
import { createSystemCatalog, SystemCatalogError } from "../../../packages/domain/src/system-catalog.mjs";
import { createPerformanceIntelligence, PerformanceError } from "../../../packages/domain/src/performance-intelligence.mjs";
import { createNotificationObservability, NotificationError } from "../../../packages/domain/src/notification-observability.mjs";
import { createInfrastructureControl, InfrastructureError } from "../../../packages/domain/src/infrastructure-control.mjs";
import { createDeliveryControl, DeliveryError } from "../../../packages/domain/src/delivery-control.mjs";
import { createOperationalHardening, HardeningError } from "../../../packages/domain/src/operational-hardening.mjs";
import { createFinalReadiness, FinalReadinessError } from "../../../packages/domain/src/final-readiness.mjs";
import { rebuildPortfolioReadModel, rebuildProjectReadModel } from "../../../packages/domain/src/backoffice-read-models.mjs";
import { ProductDevelopmentError, createProductDevelopmentCatalog } from "../../../packages/domain/src/product-development.mjs";
import { createConfiguredAiProviderAdapters, createNotionApiAdapter, createPostgresRuntime, createPricingCatalogRegistry, createRuntimeExternalSpendAuthorizer } from "../../../packages/adapters/src/index.mjs";

const PRIVATE_ROBOTS_POLICY = "noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate";
const READ_MODEL_AUDIT_RESOURCES = new Set([
  "/backoffice",
  "/backoffice-data",
  "/backoffice-events",
  "/api/dashboard",
  "/api/ai/benchmarks",
  "/api/ai/benchmarks/compare",
  "/api/ai/role-policies/history",
  "/api/teams/contract-history",
  "/api/audit",
  "/api/operations/diagnostics",
  "/product-studio",
  "/product-studio-data",
  "/product-studio-document"
]);
const BACKOFFICE_PATHS = new Set(["/backoffice", "/backoffice-data", "/backoffice-events"]);
const PRODUCT_STUDIO_PATHS = new Set(["/product-studio", "/product-studio-data", "/product-studio-document"]);
const PORTFOLIO_PATHS = new Set(["/portfolio", "/portfolio-data"]);
const IDENTITY_PATHS = new Set(["/identity"]);
const DEFAULT_BACKOFFICE_RESPONSE_LIMIT_BYTES = 512 * 1024;
const DEFAULT_BACKOFFICE_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_BACKOFFICE_RATE_LIMIT_MAX = 60;
const ADMIN_ALLOWED_MUTATIONS = new Set([
  "/api/ai/providers",
  "/api/ai/models",
  "/api/ai/profiles",
  "/api/ai/bindings",
  "/api/ai/skills",
  "/api/ai/skill-bindings",
  "/api/ai/role-policies"
]);
const PUBLIC_IDENTITY_PATHS = new Set([
  "/api/identity/login",
  "/api/identity/login/mfa",
  "/api/identity/recovery/request",
  "/api/identity/recovery/complete"
]);

function json(response, statusCode, body, { maxBytes } = {}) {
  const payload = JSON.stringify(body);
  const payloadBytes = Buffer.byteLength(payload);
  if (maxBytes !== undefined && payloadBytes > maxBytes) {
    const message = "Hero Back Office response is too large.";
    response.writeHead(413, {
      "content-type": "text/plain; charset=utf-8",
      "content-length": Buffer.byteLength(message),
      "cache-control": "no-store",
      "x-robots-tag": PRIVATE_ROBOTS_POLICY,
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer"
    });
    response.end(message);
    return;
  }
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": payloadBytes,
    "cache-control": "no-store",
    "x-robots-tag": PRIVATE_ROBOTS_POLICY,
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer"
  });
  response.end(payload);
}

function createRateLimiter({ windowMs = DEFAULT_BACKOFFICE_RATE_LIMIT_WINDOW_MS, max = DEFAULT_BACKOFFICE_RATE_LIMIT_MAX } = {}) {
  if (!Number.isInteger(windowMs) || windowMs < 1_000 || windowMs > 86_400_000) throw new Error("Back Office rate-limit window must be between 1000 and 86400000 milliseconds.");
  if (!Number.isInteger(max) || max < 1 || max > 10_000) throw new Error("Back Office rate-limit max must be between 1 and 10000 requests.");
  const entries = new Map();
  return Object.freeze({
    consume(key, now = Date.now()) {
      const current = entries.get(key);
      if (!current || now - current.startedAt >= windowMs) {
        entries.set(key, { startedAt: now, count: 1 });
        if (entries.size > 2_000) {
          for (const [entryKey, entry] of entries) {
            if (now - entry.startedAt >= windowMs) entries.delete(entryKey);
          }
        }
        return Object.freeze({ allowed: true, remaining: max - 1, retryAfter: 0 });
      }
      if (current.count >= max) {
        return Object.freeze({
          allowed: false,
          remaining: 0,
          retryAfter: Math.max(1, Math.ceil((windowMs - (now - current.startedAt)) / 1000))
        });
      }
      current.count += 1;
      return Object.freeze({ allowed: true, remaining: max - current.count, retryAfter: 0 });
    }
  });
}

function html(response, body) {
  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "content-security-policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
    "x-content-type-options": "nosniff",
    "x-robots-tag": PRIVATE_ROBOTS_POLICY,
    "referrer-policy": "no-referrer",
    "cache-control": "no-store"
  });
  response.end(body);
}

function plain(response, statusCode, body) {
  response.writeHead(statusCode, {
    "content-type": "text/plain; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
    "x-robots-tag": PRIVATE_ROBOTS_POLICY,
    "x-content-type-options": "nosniff"
  });
  response.end(body);
}

function basicAuthConfig(options = {}) {
  const configured = options.backofficeAuth ?? {
    username: process.env.HERO_BACKOFFICE_USER,
    password: process.env.HERO_BACKOFFICE_PASSWORD
  };
  const username = configured?.username;
  const password = configured?.password;
  if ((username === undefined || username === "") && (password === undefined || password === "")) return null;
  if (typeof username !== "string" || username.trim() === "" || typeof password !== "string" || password.length < 16) {
    throw new Error("Back Office Basic Auth requires a non-empty username and a password of at least 16 characters.");
  }
  return Object.freeze({ username, password });
}

function basicCredentials(request) {
  const value = request.headers.authorization;
  if (typeof value !== "string" || !value.startsWith("Basic ")) return null;
  try {
    const decoded = Buffer.from(value.slice(6), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator < 1) return null;
    return { username: decoded.slice(0, separator), password: decoded.slice(separator + 1) };
  } catch {
    return null;
  }
}

function matchesBasicAuth(credentials, expected) {
  if (!credentials || !expected) return false;
  const actualUser = Buffer.from(credentials.username);
  const expectedUser = Buffer.from(expected.username);
  const actualPassword = Buffer.from(credentials.password);
  const expectedPassword = Buffer.from(expected.password);
  return actualUser.length === expectedUser.length && actualPassword.length === expectedPassword.length &&
    timingSafeEqual(actualUser, expectedUser) && timingSafeEqual(actualPassword, expectedPassword);
}

async function readJson(request, maxBytes = 16_384) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw new DashboardCommandError("PAYLOAD_TOO_LARGE", "درخواست بیش از حد بزرگ است.");
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new DashboardCommandError("INVALID_INPUT", "بدنهٔ درخواست معتبر نیست.");
    }
    return value;
  } catch (error) {
    if (error instanceof DashboardCommandError) throw error;
    throw new DashboardCommandError("INVALID_JSON", "بدنهٔ درخواست باید JSON معتبر باشد.");
  }
}

function parsePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error("HERO_HTTP_PORT must be an integer between 0 and 65535.");
  }
  return port;
}

function isAdminAllowedMutation(pathname) {
  return ADMIN_ALLOWED_MUTATIONS.has(pathname) || /^\/api\/ai\/role-policies\/[a-z][a-z0-9-]{2,63}\/rollback$/.test(pathname) || /^\/api\/teams\/[a-z][a-z0-9-]{2,63}\/principles(?:\/rollback)?$/.test(pathname);
}

function readModelAuditResource(pathname) {
  if (READ_MODEL_AUDIT_RESOURCES.has(pathname)) return pathname;
  if (/^\/api\/ai\/role-policies\/[a-z][a-z0-9-]{2,63}\/history$/.test(pathname)) return "/api/ai/role-policies/history";
  if (/^\/api\/teams\/[a-z][a-z0-9-]{2,63}\/contract-history$/.test(pathname)) return "/api/teams/contract-history";
  return null;
}

export function createHeroServer(options = {}) {
  const host = options.host ?? process.env.HERO_HTTP_HOST ?? "127.0.0.1";
  const port = parsePort(options.port ?? process.env.HERO_HTTP_PORT ?? "3100");
  const backofficeAuth = basicAuthConfig(options);
  const requirePostgres = options.requirePostgres ?? process.env.HERO_REQUIRE_POSTGRES === "true";
  const backofficeResponseLimitBytes = options.backofficeResponseLimitBytes ?? DEFAULT_BACKOFFICE_RESPONSE_LIMIT_BYTES;
  if (!Number.isInteger(backofficeResponseLimitBytes) || backofficeResponseLimitBytes < 1_024 || backofficeResponseLimitBytes > 10 * 1024 * 1024) {
    throw new Error("Back Office response limit must be between 1024 and 10485760 bytes.");
  }
  const backofficeRateLimiter = createRateLimiter(options.backofficeRateLimit);
  const pricingCatalog = options.pricingCatalogRegistry ?? createPricingCatalogRegistry({ now: options.clock ?? (() => Date.now()) });
  if (options.pricingCatalog) {
    pricingCatalog.publish(options.pricingCatalog);
    pricingCatalog.activate(options.pricingCatalog.catalogVersion ?? options.pricingCatalog.catalog_version);
  }
  const requestedProviderAdapterOptions = options.providerAdapterOptions ?? {};
  const providerAdapterOptions = Object.fromEntries(["openai", "anthropic", "google", "openai-compatible"].map(providerId => [
    providerId,
    { ...(requestedProviderAdapterOptions[providerId] ?? {}), pricingCatalog: requestedProviderAdapterOptions[providerId]?.pricingCatalog ?? pricingCatalog }
  ]));
  const providerAdapters = options.providerAdapters ?? ((options.enableRealProviders === true || process.env.HERO_ENABLE_REAL_PROVIDERS === "true")
    ? createConfiguredAiProviderAdapters(providerAdapterOptions)
    : Object.freeze({}));
  const externalSpendAuthorizer = options.externalSpendAuthorizer ?? createRuntimeExternalSpendAuthorizer();
  const dashboard = options.dashboard ?? createControlDashboard({ now: options.now, providerAdapters, externalSpendAuthorizer });
  const productDevelopment = options.productDevelopment ?? createProductDevelopmentCatalog({
    root: options.repositoryRoot ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.."),
    sourceCommit: options.sourceCommit,
    now: options.now ?? (() => new Date().toISOString())
  });
  const notionAdapter = options.notionAdapter ?? createNotionApiAdapter();
  const ownerAuth = options.ownerAuth ?? createOwnerAuth({ secret: process.env.HERO_OWNER_AUTH_SECRET, now: options.now });
  const adminAuth = options.adminAuth ?? createAdminAuth({ secret: process.env.HERO_ADMIN_AUTH_SECRET, now: options.now });
  const identityOwner = {
    userId: process.env.HERO_IDENTITY_OWNER_USER_ID ?? "hero-owner",
    email: process.env.HERO_OWNER_EMAIL,
    displayName: process.env.HERO_OWNER_DISPLAY_NAME ?? "Hero Owner",
    password: process.env.HERO_OWNER_PASSWORD,
    mfaSecret: process.env.HERO_OWNER_MFA_SECRET,
    mfaSecretRef: process.env.HERO_OWNER_MFA_SECRET_REF ?? "env:HERO_OWNER_MFA_SECRET"
  };
  const identityConfiguredFromEnvironment = [process.env.HERO_IDENTITY_SESSION_SECRET, identityOwner.email, identityOwner.password, identityOwner.mfaSecret].every(value => typeof value === "string" && value.length > 0);
  const projectAccessRegistry = options.projectAccessRegistry ?? (identityConfiguredFromEnvironment
    ? createProjectAccessRegistry({ ownerUserId: identityOwner.userId, ownerUser: identityOwner, now: options.now })
    : null);
  const humanIdentity = options.humanIdentity ?? (identityConfiguredFromEnvironment
    ? createHumanIdentity({ accessRegistry: projectAccessRegistry, sessionSecret: process.env.HERO_IDENTITY_SESSION_SECRET, owner: identityOwner, now: options.now })
    : null);
  const projectAccessMiddleware = options.projectAccessMiddleware ?? (projectAccessRegistry && humanIdentity
    ? createProjectAccessMiddleware({ accessRegistry: projectAccessRegistry, identity: humanIdentity })
    : null);
  const projectSettings = options.projectSettings ?? createProjectSettingsRegistry({ now: options.now });
  const projectWorkspace = options.projectWorkspace ?? createProjectWorkspace({
    ownerUserId: identityOwner.userId,
    now: options.now,
    settings: projectSettings,
    scanner: options.uploadScanner,
    parser: options.projectInputParser
  });
  const projectCollaboration = options.projectCollaboration ?? createProjectCollaboration({ now: options.now });
  const commandCenter = options.commandCenter ?? createCommandCenter({ now: options.now });
  const systemCatalog = options.systemCatalog ?? createSystemCatalog({ now: options.now });
  const performanceIntelligence = options.performanceIntelligence ?? createPerformanceIntelligence({ now: options.now });
  const notificationObservability = options.notificationObservability ?? createNotificationObservability({ now: options.now });
  const infrastructureControl = options.infrastructureControl ?? createInfrastructureControl({ now: options.now });
  const deliveryControl = options.deliveryControl ?? createDeliveryControl({ now: options.now });
  const operationalHardening = options.operationalHardening ?? createOperationalHardening({ now: options.now });
  const finalReadiness = options.finalReadiness ?? createFinalReadiness({ now: options.now });
  let postgresRuntime = options.postgresRuntime ?? null;
  let ownsPostgresRuntime = false;
  let persistedDomainEventIds = new Set();
  const persistedWorkspaceRecords = new Set();

  function workspaceRecordKey(kind, value) {
    if (kind === "project") return `${kind}:${value.projectId}:${value.version}`;
    if (kind === "input") return `${kind}:${value.uploadId}`;
    if (kind === "proposal") return `${kind}:${value.proposalId}:${value.version}`;
    if (kind === "setting") return `${kind}:${value.projectId}:${value.path}:${value.layer}:${value.runId ?? "-"}:${value.version}`;
    return `${kind}:${value.importId}`;
  }

  async function persistWorkspaceProject(project, reason = null) {
    if (!postgresRuntime?.projectWorkspace || !project) return;
    const key = workspaceRecordKey("project", project);
    if (persistedWorkspaceRecords.has(key)) return;
    await postgresRuntime.projectWorkspace.appendProject({ projectId: project.projectId, version: project.version, name: project.name, description: project.description, lifecycle: project.lifecycle, status: project.status, intake: project.intake, actorId: project.createdBy ?? identityOwner.userId, reason });
    persistedWorkspaceRecords.add(key);
  }

  async function persistWorkspaceInput(input) {
    if (!postgresRuntime?.projectWorkspace || !input) return;
    const key = workspaceRecordKey("input", input);
    if (persistedWorkspaceRecords.has(key)) return;
    const publicMetadata = input.type === "link" ? { public: { label: input.label, url: input.url, fetchState: input.fetchState } } : {};
    await postgresRuntime.projectWorkspace.recordInput({ inputId: input.uploadId, projectId: input.projectId, type: input.type, filename: input.filename ?? input.label ?? null, objectKey: input.objectKey ?? null, checksum: input.checksum ?? null, byteLength: input.byteLength ?? null, scanState: input.scan?.state ?? "pending-separate-authorization", parseState: input.parse?.state ?? "deferred-adapter-required", reviewRequired: input.parse?.reviewRequired === true, metadata: publicMetadata });
    persistedWorkspaceRecords.add(key);
  }

  async function persistWorkspaceProposal(proposal) {
    if (!postgresRuntime?.projectWorkspace || !proposal) return;
    const key = workspaceRecordKey("proposal", proposal);
    if (persistedWorkspaceRecords.has(key)) return;
    await postgresRuntime.projectWorkspace.appendFoundationProposal({ proposalId: proposal.proposalId, projectId: proposal.projectId, version: proposal.version, state: proposal.state, proposal, actorId: proposal.approvedBy ?? proposal.createdBy ?? identityOwner.userId });
    persistedWorkspaceRecords.add(key);
  }

  async function persistWorkspaceSettings(projectId) {
    if (!postgresRuntime?.projectWorkspace || !projectSettings.listRecords) return;
    for (const setting of projectSettings.listRecords({ projectId })) {
      const key = workspaceRecordKey("setting", setting);
      if (persistedWorkspaceRecords.has(key)) continue;
      await postgresRuntime.projectWorkspace.appendSetting({ projectId: setting.projectId, path: setting.path, layer: setting.layer, runId: setting.runId ?? "", version: setting.version, value: setting.value, actorId: setting.actor, reason: setting.reason ?? "Hydrated setting", impact: setting.impact ?? "not-assessed", rollbackReference: setting.rollbackReference ?? null, source: setting.source ?? setting.layer });
      persistedWorkspaceRecords.add(key);
    }
  }

  async function persistWorkspaceImport(plan) {
    if (!postgresRuntime?.projectWorkspace || !plan) return;
    const key = workspaceRecordKey("import", plan);
    if (persistedWorkspaceRecords.has(key)) return;
    await postgresRuntime.projectWorkspace.recordImportPlan({ importId: plan.importId, projectId: plan.projectId, repositoryUrl: plan.repositoryUrl, state: plan.state, inventory: plan.inventory, adoptionPlan: plan.adoptionPlan, actorId: plan.createdBy ?? identityOwner.userId });
    persistedWorkspaceRecords.add(key);
  }

  function backofficeSnapshot() {
    const snapshot = dashboard.backofficeSnapshot();
    const settings = snapshot.settings ?? {};
    const persistence = settings.persistence ?? {};
    return Object.freeze({
      ...snapshot,
      settings: Object.freeze({
        ...settings,
        persistence: Object.freeze({
          ...persistence,
          runtime: postgresRuntime ? "postgresql" : "in-memory",
          readiness: requirePostgres
            ? postgresRuntime ? "ready" : "blocked-persistence-required"
            : "development-or-optional"
        })
      })
    });
  }

  function productStudioSnapshot({ projectId = null } = {}) {
    const catalog = productDevelopment.snapshot();
    const snapshot = {
      ...catalog,
      notion: Object.freeze({
        configured: notionAdapter.configured === true,
        status: notionAdapter.configured === true ? "api-ready-not-yet-authorized" : "not-configured",
        mode: notionAdapter.configured === true ? "api-ready" : "disabled",
        message: notionAdapter.configured === true
          ? "Token پیدا شد؛ Workspace، parent page، scope و مجوز ارسال هنوز باید جداگانه تأیید شوند."
          : "NOTION_API_TOKEN تنظیم نشده است؛ هیچ درخواست خارجی ارسال نمی‌شود."
      })
    };
    if (projectId) snapshot.projectOverview = projectOverview(projectId);
    return Object.freeze(snapshot);
  }

  function projectOverview(projectId) {
    const project = projectWorkspace.getProject(projectId);
    const inputs = projectWorkspace.listInputs({ projectId });
    const foundation = projectWorkspace.foundationProposal({ projectId });
    const settings = projectSettings.effectiveProject({ projectId }).map(item => ({ path: item.path, value: item.value, source: item.provenance, layer: item.layer, version: item.version }));
    const model = rebuildProjectReadModel({ project: {
      ...project,
      health: "unknown",
      tokenUsage: null,
      latestCompletedTask: null,
      nextTasks: foundation?.suggested?.roadmap ?? [],
      latestOutput: null
    } });
    const safeInputs = inputs.map(input => ({ uploadId: input.uploadId, type: input.type, filename: input.filename ?? input.label ?? null, url: input.type === "link" ? input.url : null, fetchState: input.fetchState ?? null, byteLength: input.byteLength ?? null, checksum: input.checksum ?? null, scan: input.scan?.state ?? null, parse: input.parse?.state ?? null, reviewRequired: input.parse?.reviewRequired === true, createdAt: input.createdAt ?? null }));
    return Object.freeze({ ...model, intake: project.intake, foundationProposal: foundation, inputCount: inputs.length, inputs: safeInputs, imports: projectWorkspace.listImportPlans({ projectId }), settings });
  }

  function portfolioSnapshot(principal = null) {
    const accessible = principal?.source === "human-identity" ? projectAccessRegistry.listAccessibleProjectIds({ principal }) : null;
    const projects = projectWorkspace.listProjects().filter(project => accessible === null || accessible.includes(project.projectId));
    const model = rebuildPortfolioReadModel({ projects });
    const cards = model.projects.map(project => ({
      projectId: project.projectId,
      name: project.name,
      lifecycle: project.lifecycle,
      health: project.health,
      roadmap: project.nextTasks,
      tokenUsage: project.tokenUsage,
      latestCompletedTask: project.latestCompletedTask,
      latestOutput: project.latestOutput,
      drillDown: { href: `/product-studio?projectId=${encodeURIComponent(project.projectId)}`, projectId: project.projectId }
    }));
    return Object.freeze({ ...model, cards, informationArchitecture: ["Portfolio", "Project Studio", "Overview", "Roadmap", "Inputs", "Settings", "Outputs"] });
  }

  function searchPortfolio({ principal = null, query = "" } = {}) {
    const needle = String(query).trim().toLowerCase();
    if (needle.length < 2 || needle.length > 120) throw new ProjectWorkspaceError("SEARCH_QUERY_INVALID", "Search query must be 2-120 characters.", 400);
    const accessible = principal?.source === "human-identity" ? projectAccessRegistry.listAccessibleProjectIds({ principal }) : null;
    const results = [];
    for (const project of projectWorkspace.listProjects()) {
      if (accessible !== null && !accessible.includes(project.projectId)) continue;
      const haystack = `${project.projectId} ${project.name} ${project.description} ${project.intake.intent} ${project.intake.goal}`.toLowerCase();
      if (haystack.includes(needle)) results.push({ kind: "project", projectId: project.projectId, label: project.name, href: `/api/projects/${encodeURIComponent(project.projectId)}/workspace-overview` });
      for (const entity of systemCatalog.list({ projectId: project.projectId })) {
        if (`${entity.entityId} ${entity.name} ${entity.type}`.toLowerCase().includes(needle)) results.push({ kind: "system-entity", projectId: project.projectId, entityId: entity.entityId, label: entity.name, href: `/api/projects/${encodeURIComponent(project.projectId)}/catalog` });
      }
    }
    return Object.freeze(results.slice(0, 100));
  }

  function authenticateApiPrincipal(authorizationHeader) {
    try {
      const owner = ownerAuth.requireOwner(authorizationHeader);
      return Object.freeze({ ...owner, actor: Object.freeze({ kind: "project-owner", id: owner.subject }) });
    } catch (ownerError) {
      if (adminAuth.configured) {
        try {
          const admin = adminAuth.requireAdmin(authorizationHeader);
          return Object.freeze({ ...admin, actor: Object.freeze({ kind: "admin", id: admin.subject }) });
        } catch {
          // A different valid identity scheme may still authenticate this request.
        }
      }
      if (humanIdentity?.configured) {
        try {
          return projectAccessMiddleware.authenticate(authorizationHeader);
        } catch (identityError) {
          if (identityError instanceof HumanIdentityError) throw identityError;
        }
      }
      throw ownerError;
    }
  }

  function assertApiPermission(request, url, principal) {
    if (principal.source === "human-identity") {
      if (url.pathname.startsWith("/api/identity/")) return;
      if (url.pathname === "/api/projects" && request.method === "POST") {
        projectAccessRegistry.authorize({ principal, projectId: "hero", action: "project.create" });
        return;
      }
      if (url.pathname === "/api/project-clones" && request.method === "POST") {
        projectAccessRegistry.authorize({ principal, projectId: "hero", action: "project.create" });
        return;
      }
      if (["/api/portfolio", "/api/portfolio/search"].includes(url.pathname) && request.method === "GET") return;
      const projectMatch = url.pathname.match(/^\/api\/projects\/([A-Za-z][A-Za-z0-9._:-]{2,127})(?:\/|$)/);
      const projectId = projectMatch?.[1] ?? url.searchParams.get("projectId");
      if (!projectId) throw new ProjectAccessError("PROJECT_SCOPE_REQUIRED", "A projectId is required for human-identity API access.", 403);
      const action = request.method === "GET" ? "project.read" : "project.write";
      projectAccessMiddleware.requireProject({ principal, projectId, action });
      return;
    }
    if (principal.role !== "admin") return;
    if (request.method === "GET" || (request.method === "POST" && isAdminAllowedMutation(url.pathname))) return;
    throw new OwnerAuthError("ADMIN_SCOPE_FORBIDDEN", "این عملیات فقط با دسترسی مالک پروژه مجاز است.", 403);
  }

  async function recordReadAccess(resource, outcome, actor = { kind: "anonymous", id: "anonymous" }) {
    if (!postgresRuntime?.accessAudit || !READ_MODEL_AUDIT_RESOURCES.has(resource)) return;
    try {
      await postgresRuntime.accessAudit.record({
        resource,
        outcome,
        actorKind: actor.kind,
        actorId: actor.id
      });
    } catch {
      // A read-model audit outage must not turn a safe read into a 500 response.
    }
  }

  async function persistNewDomainEvents() {
    if (!postgresRuntime?.store || typeof postgresRuntime.store.appendEvent !== "function" || typeof dashboard.domainEvents !== "function") return;
    const events = [...dashboard.domainEvents()].sort((left, right) =>
      `${left.aggregateType}:${left.aggregateId}`.localeCompare(`${right.aggregateType}:${right.aggregateId}`) ||
      (left.aggregateVersion ?? 0) - (right.aggregateVersion ?? 0)
    );
    for (const event of events) {
      if (persistedDomainEventIds.has(event.eventId)) continue;
      await postgresRuntime.store.appendEvent(event, {
        expectedVersion: Math.max(0, (event.aggregateVersion ?? 1) - 1),
        outbox: { outboxId: `hero-domain-${event.eventId}`, topic: "hero.domain.events" }
      });
      persistedDomainEventIds.add(event.eventId);
    }
  }

  async function persistIdentityUser(userId) {
    if (!postgresRuntime?.projectIdentity || !humanIdentity?.persistenceRecord) return;
    await postgresRuntime.projectIdentity.saveUser(humanIdentity.persistenceRecord({ userId }));
  }

  async function persistIdentityAudit({ userId = null, eventType, outcome = "accepted", data = {} }) {
    if (!postgresRuntime?.projectIdentity?.recordAudit) return;
    await postgresRuntime.projectIdentity.recordAudit({ auditId: `identity-audit-${crypto.randomUUID()}`, userId, eventType, outcome, data });
  }

  async function executeDashboardCommand(command, input, operation, actor = { kind: "project-owner", id: "hero-owner" }) {
    const projectIdCandidate = input?.projectId ?? input?.organizationId;
    const projectId = typeof projectIdCandidate === "string" && /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/.test(projectIdCandidate)
      ? projectIdCandidate
      : "hero";
    let result;
    try {
      result = await operation();
    } catch (error) {
      if (postgresRuntime?.audit) {
        try {
          await postgresRuntime.audit.record({
            command,
            projectId,
            actor,
            outcome: "rejected"
          });
        } catch {
          // Preserve the original command error if audit persistence is unavailable.
        }
      }
      throw error;
    }
    if (postgresRuntime?.audit) {
      await persistNewDomainEvents();
      const auditEvent = await postgresRuntime.audit.record({
        command,
        projectId,
        actor,
        outcome: "accepted"
      });
      if (postgresRuntime.registrySnapshots && typeof dashboard.persistenceSnapshot === "function") {
        const state = dashboard.persistenceSnapshot();
        for (const registry of state.registries) {
          await postgresRuntime.registrySnapshots.save({
            registryId: registry.registryId,
            schemaVersion: registry.schemaVersion,
            sourceSequence: auditEvent.sequence ?? 0,
            data: registry
          });
        }
      }
    }
    return result;
  }

  const server = http.createServer((request, response) => void handle(request, response));

  async function handle(request, response) {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

    try {
      const backofficePath = BACKOFFICE_PATHS.has(url.pathname);
      const productStudioPath = PRODUCT_STUDIO_PATHS.has(url.pathname);
      const portfolioPath = PORTFOLIO_PATHS.has(url.pathname);
      const identityPath = IDENTITY_PATHS.has(url.pathname);
      if (backofficePath || productStudioPath || portfolioPath || identityPath) {
        const rate = backofficeRateLimiter.consume(request.socket?.remoteAddress ?? "unknown");
        if (!rate.allowed) {
          response.writeHead(429, {
            "content-type": "text/plain; charset=utf-8",
            "content-length": Buffer.byteLength("Hero Back Office rate limit exceeded."),
            "cache-control": "no-store",
            "retry-after": String(rate.retryAfter),
            "x-robots-tag": PRIVATE_ROBOTS_POLICY,
            "x-content-type-options": "nosniff",
            "referrer-policy": "no-referrer"
          });
          response.end("Hero Back Office rate limit exceeded.");
          return;
        }
      }
      if ((backofficePath || productStudioPath || portfolioPath || identityPath) && backofficeAuth && !matchesBasicAuth(basicCredentials(request), backofficeAuth)) {
        await recordReadAccess(url.pathname, "rejected");
        response.writeHead(401, {
          "www-authenticate": 'Basic realm="Hero Back Office", charset="UTF-8"',
          "cache-control": "no-store",
          "x-robots-tag": PRIVATE_ROBOTS_POLICY,
          "x-content-type-options": "nosniff"
        });
        response.end("Back Office authentication required.");
        return;
      }
      if ((backofficePath || productStudioPath || portfolioPath || identityPath) && request.method !== "GET") {
        response.writeHead(405, {
          "allow": "GET",
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store",
          "x-robots-tag": PRIVATE_ROBOTS_POLICY,
          "x-content-type-options": "nosniff",
          "referrer-policy": "no-referrer"
        });
        response.end("Hero Back Office is read-only; GET is the only allowed method.");
        return;
      }

      if (request.method === "GET" && url.pathname === "/robots.txt") {
        return plain(response, 200, "User-agent: *\nDisallow: /\n");
      }

      if (request.method === "GET" && url.pathname === "/backoffice") {
        await recordReadAccess("/backoffice", "accepted", { kind: backofficeAuth ? "backoffice-basic-auth" : "project-owner", id: backofficeAuth ? "backoffice-user" : "development-local" });
        return html(response, getBackofficeHtml({ initialData: backofficeSnapshot() }));
      }

      if (request.method === "GET" && url.pathname === "/identity") {
        await recordReadAccess("/backoffice", "accepted", { kind: backofficeAuth ? "backoffice-basic-auth" : "project-owner", id: backofficeAuth ? "backoffice-user" : "development-local" });
        return html(response, getIdentityHtml());
      }

      if (request.method === "GET" && url.pathname === "/backoffice-data") {
        await recordReadAccess("/backoffice-data", "accepted", { kind: backofficeAuth ? "backoffice-basic-auth" : "project-owner", id: backofficeAuth ? "backoffice-user" : "development-local" });
        return json(response, 200, { service: HERO_SERVICE, backoffice: backofficeSnapshot() }, { maxBytes: backofficeResponseLimitBytes });
      }

      if (request.method === "GET" && url.pathname === "/backoffice-events") {
        await recordReadAccess("/backoffice-events", "accepted", { kind: backofficeAuth ? "backoffice-basic-auth" : "project-owner", id: backofficeAuth ? "backoffice-user" : "development-local" });
        const after = Number(url.searchParams.get("after") ?? "0");
        const limit = Number(url.searchParams.get("limit") ?? "24");
        if (!Number.isInteger(after) || after < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
          throw new DashboardCommandError("INVALID_INPUT", "مقادیر after و limit معتبر نیستند.");
        }
        if (postgresRuntime?.store) {
          const allStored = await postgresRuntime.store.readAfter(after);
          const stored = allStored.slice(0, limit);
          return json(response, 200, {
            service: HERO_SERVICE,
            events: stored.map(projectOperationalEvent),
            nextAfter: stored.at(-1)?.sequence ?? after,
            hasMore: allStored.length > limit,
            source: "postgresql-events"
          }, { maxBytes: backofficeResponseLimitBytes });
        }
        return json(response, 200, { service: HERO_SERVICE, ...dashboard.backofficeEvents({ after, limit }) }, { maxBytes: backofficeResponseLimitBytes });
      }

      if (request.method === "GET" && url.pathname === "/product-studio") {
        await recordReadAccess("/product-studio", "accepted", { kind: backofficeAuth ? "backoffice-basic-auth" : "project-owner", id: backofficeAuth ? "backoffice-user" : "development-local" });
        return html(response, getProductStudioHtml({ initialData: productStudioSnapshot({ projectId: url.searchParams.get("projectId") }) }));
      }

      if (request.method === "GET" && url.pathname === "/product-studio-data") {
        await recordReadAccess("/product-studio-data", "accepted", { kind: backofficeAuth ? "backoffice-basic-auth" : "project-owner", id: backofficeAuth ? "backoffice-user" : "development-local" });
        return json(response, 200, productStudioSnapshot({ projectId: url.searchParams.get("projectId") }), { maxBytes: backofficeResponseLimitBytes });
      }

      if (request.method === "GET" && url.pathname === "/product-studio-document") {
        await recordReadAccess("/product-studio-document", "accepted", { kind: backofficeAuth ? "backoffice-basic-auth" : "project-owner", id: backofficeAuth ? "backoffice-user" : "development-local" });
        const documentId = url.searchParams.get("documentId");
        if (!documentId) throw new ProductDevelopmentError("DOCUMENT_ID_REQUIRED", "documentId is required.", 400);
        return json(response, 200, { service: HERO_SERVICE, document: productDevelopment.document(documentId) }, { maxBytes: backofficeResponseLimitBytes });
      }

      if (request.method === "GET" && url.pathname === "/portfolio") {
        return html(response, getPortfolioHtml({ portfolio: portfolioSnapshot() }));
      }

      if (request.method === "GET" && url.pathname === "/portfolio-data") {
        return json(response, 200, { service: HERO_SERVICE, portfolio: portfolioSnapshot() }, { maxBytes: backofficeResponseLimitBytes });
      }

      const authenticatedOwner = url.pathname.startsWith("/api/") && !PUBLIC_IDENTITY_PATHS.has(url.pathname)
        ? authenticateApiPrincipal(request.headers.authorization)
        : null;
      if (authenticatedOwner) assertApiPermission(request, url, authenticatedOwner);

      const readAuditResource = request.method === "GET" ? readModelAuditResource(url.pathname) : null;
      if (readAuditResource) {
        await recordReadAccess(readAuditResource, "accepted", { kind: authenticatedOwner?.actor.kind ?? "project-owner", id: authenticatedOwner?.subject ?? "development-local" });
      }

      if (request.method === "GET" && url.pathname === "/api/audit") {
        const after = Number(url.searchParams.get("after") ?? "0");
        const limit = Number(url.searchParams.get("limit") ?? "50");
        if (!Number.isInteger(after) || after < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
          throw new DashboardCommandError("INVALID_INPUT", "مقادیر after و limit معتبر نیستند.");
        }
        if (!postgresRuntime?.store) {
          return json(response, 503, { service: HERO_SERVICE, status: "persistence_unavailable", code: "PERSISTENCE_NOT_CONFIGURED" });
        }
        const allEvents = await postgresRuntime.store.readAfter(after);
        const events = allEvents.slice(0, limit);
        return json(response, 200, {
          service: HERO_SERVICE,
          events,
          nextAfter: events.at(-1)?.sequence ?? after,
          hasMore: allEvents.length > limit,
          source: "postgresql-events"
        });
      }

      if (request.method === "GET" && url.pathname === "/api/audit/read-access") {
        const after = Number(url.searchParams.get("after") ?? "0");
        const limit = Number(url.searchParams.get("limit") ?? "50");
        if (!Number.isInteger(after) || after < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
          throw new DashboardCommandError("INVALID_INPUT", "مقادیر after و limit معتبر نیستند.");
        }
        if (!postgresRuntime?.accessAudit) {
          return json(response, 503, { service: HERO_SERVICE, status: "persistence_unavailable", code: "PERSISTENCE_NOT_CONFIGURED" });
        }
        return json(response, 200, { service: HERO_SERVICE, source: "postgresql", audit: await postgresRuntime.accessAudit.list({ after, limit }) });
      }

      if (request.method === "POST" && url.pathname === "/api/auth/revoke-session") {
        const input = await readJson(request);
        const sessionId = input.sessionId ?? authenticatedOwner.sessionId;
        const revocation = ownerAuth.revokeSession({
          sessionId,
          subject: authenticatedOwner.subject,
          reason: input.reason
        });
        if (postgresRuntime?.ownerSessions) {
          await postgresRuntime.ownerSessions.revoke(revocation);
        }
        return json(response, 200, { service: HERO_SERVICE, revocation });
      }

      if (request.method === "POST" && url.pathname === "/api/identity/login") {
        if (!humanIdentity?.configured) throw new HumanIdentityError("IDENTITY_NOT_CONFIGURED", "Human identity is not configured.", 503);
        const input = await readJson(request);
        const login = humanIdentity.beginLogin(input);
        await persistIdentityAudit({ eventType: "identity.login-challenged", data: { mfaRequired: login.mfaRequired } });
        return json(response, 200, { service: HERO_SERVICE, login });
      }

      if (request.method === "POST" && url.pathname === "/api/identity/login/mfa") {
        if (!humanIdentity?.configured) throw new HumanIdentityError("IDENTITY_NOT_CONFIGURED", "Human identity is not configured.", 503);
        const input = await readJson(request);
        const session = humanIdentity.completeLogin(input);
        await persistIdentityAudit({ userId: session.principal.subject, eventType: "identity.session-issued", data: { sessionId: session.principal.sessionId } });
        return json(response, 200, { service: HERO_SERVICE, session });
      }

      if (request.method === "POST" && url.pathname === "/api/identity/recovery/request") {
        if (!humanIdentity?.configured) throw new HumanIdentityError("IDENTITY_NOT_CONFIGURED", "Human identity is not configured.", 503);
        const input = await readJson(request);
        const recovery = humanIdentity.requestOwnerRecovery(input);
        await persistIdentityAudit({ eventType: "identity.recovery-requested", data: { accepted: recovery.accepted } });
        return json(response, 202, { service: HERO_SERVICE, recovery });
      }

      if (request.method === "POST" && url.pathname === "/api/identity/recovery/complete") {
        if (!humanIdentity?.configured) throw new HumanIdentityError("IDENTITY_NOT_CONFIGURED", "Human identity is not configured.", 503);
        const input = await readJson(request);
        const recovery = humanIdentity.completeOwnerRecovery(input);
        await persistIdentityAudit({ userId: identityOwner.userId, eventType: "identity.recovery-completed", data: { recovered: recovery.recovered } });
        return json(response, 200, { service: HERO_SERVICE, recovery });
      }

      if (request.method === "GET" && url.pathname === "/api/identity/me") {
        if (!humanIdentity?.configured || !authenticatedOwner?.source) throw new HumanIdentityError("IDENTITY_AUTH_REQUIRED", "Human authentication is required.", 401);
        return json(response, 200, { service: HERO_SERVICE, principal: authenticatedOwner, user: humanIdentity.getUser(authenticatedOwner.subject) });
      }

      if (request.method === "POST" && url.pathname === "/api/identity/step-up") {
        if (!humanIdentity?.configured || !authenticatedOwner?.source) throw new HumanIdentityError("IDENTITY_AUTH_REQUIRED", "Human authentication is required.", 401);
        const input = await readJson(request);
        const session = humanIdentity.stepUp({ principal: authenticatedOwner, mfaCode: input.mfaCode });
        await persistIdentityAudit({ userId: authenticatedOwner.subject, eventType: "identity.step-up-verified", data: { sessionId: session.principal.sessionId } });
        return json(response, 200, { service: HERO_SERVICE, session });
      }

      if (request.method === "POST" && url.pathname === "/api/identity/sessions/revoke") {
        if (!humanIdentity?.configured || !authenticatedOwner?.source) throw new HumanIdentityError("IDENTITY_AUTH_REQUIRED", "Human authentication is required.", 401);
        const input = await readJson(request);
        const revocation = humanIdentity.revokeSession({ actor: authenticatedOwner, sessionId: input.sessionId, reason: input.reason });
        if (postgresRuntime?.projectIdentity?.revokeSession) await postgresRuntime.projectIdentity.revokeSession({ sessionId: revocation.sessionId, userId: authenticatedOwner.subject, reason: revocation.reason });
        await persistIdentityAudit({ userId: authenticatedOwner.subject, eventType: "identity.session-revoked", data: { sessionId: revocation.sessionId, reason: revocation.reason } });
        return json(response, 200, { service: HERO_SERVICE, revocation });
      }

      if (request.method === "GET" && url.pathname === "/api/identity/users") {
        if (!humanIdentity?.configured || !authenticatedOwner) throw new HumanIdentityError("IDENTITY_NOT_CONFIGURED", "Human identity is not configured.", 503);
        return json(response, 200, { service: HERO_SERVICE, users: humanIdentity.listUsers({ actor: authenticatedOwner }) });
      }

      if (request.method === "POST" && url.pathname === "/api/identity/users") {
        if (!humanIdentity?.configured || !authenticatedOwner) throw new HumanIdentityError("IDENTITY_NOT_CONFIGURED", "Human identity is not configured.", 503);
        const input = await readJson(request);
        const user = humanIdentity.createUser({ actor: authenticatedOwner, user: input });
        await persistIdentityUser(user.userId);
        await persistIdentityAudit({ userId: user.userId, eventType: "identity.user-created", data: { createdBy: authenticatedOwner.subject, role: "viewer" } });
        return json(response, 201, { service: HERO_SERVICE, user });
      }

      if (request.method === "GET" && url.pathname === "/api/portfolio") {
        return json(response, 200, { service: HERO_SERVICE, portfolio: portfolioSnapshot(authenticatedOwner) });
      }

      if (request.method === "GET" && url.pathname === "/api/portfolio/search") {
        return json(response, 200, { service: HERO_SERVICE, query: url.searchParams.get("q") ?? "", results: searchPortfolio({ principal: authenticatedOwner, query: url.searchParams.get("q") ?? "" }) });
      }

      if (request.method === "POST" && url.pathname === "/api/projects") {
        const input = await readJson(request);
        const created = projectWorkspace.createProject({ actor: authenticatedOwner, projectId: input.projectId, name: input.name, description: input.description, intake: input.intake });
        await persistWorkspaceProject(created.project, "Project created");
        await persistWorkspaceProposal(created.foundationProposal);
        return json(response, 201, { service: HERO_SERVICE, ...created });
      }

      if (request.method === "POST" && url.pathname === "/api/project-clones") {
        if (authenticatedOwner?.role !== "project-owner") throw new ProjectWorkspaceError("OWNER_REQUIRED", "Only the owner may clone a project template.", 403);
        const input = await readJson(request);
        const cloned = projectWorkspace.cloneFromTemplate({ actor: authenticatedOwner, sourceProjectId: input.sourceProjectId, projectId: input.projectId, name: input.name, description: input.description });
        await persistWorkspaceProject(cloned.project, `Cloned from ${input.sourceProjectId}`);
        await persistWorkspaceProposal(cloned.foundationProposal);
        return json(response, 201, { service: HERO_SERVICE, ...cloned });
      }

      const projectArchiveMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})\/archive$/);
      if (projectArchiveMatch && request.method === "POST") {
        const input = await readJson(request);
        const project = projectWorkspace.archiveProject({ actor: authenticatedOwner, projectId: projectArchiveMatch[1], expectedVersion: input.expectedVersion, reason: input.reason });
        await persistWorkspaceProject(project, input.reason);
        return json(response, 200, { service: HERO_SERVICE, project });
      }

      const projectDeletionMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})\/deletion-request$/);
      if (projectDeletionMatch && request.method === "POST") {
        const input = await readJson(request);
        const deletionRequest = projectWorkspace.requestDeletion({ actor: authenticatedOwner, projectId: projectDeletionMatch[1], expectedVersion: input.expectedVersion, reason: input.reason });
        await persistWorkspaceProject(projectWorkspace.getProject(projectDeletionMatch[1]), input.reason);
        return json(response, 202, { service: HERO_SERVICE, deletionRequest });
      }

      const projectIntakeMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})\/intake$/);
      if (projectIntakeMatch && request.method === "POST") {
        const input = await readJson(request);
        const result = projectWorkspace.submitIntake({ actor: authenticatedOwner, projectId: projectIntakeMatch[1], expectedVersion: input.expectedVersion, intake: input.intake });
        await persistWorkspaceProject(result.project, "Intake updated");
        await persistWorkspaceProposal(result.foundationProposal);
        return json(response, 200, { service: HERO_SERVICE, result });
      }

      const projectUploadMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})\/inputs\/upload$/);
      if (projectUploadMatch && request.method === "POST") {
        const input = await readJson(request, 5 * 1024 * 1024);
        const storedInput = projectWorkspace.upload({ actor: authenticatedOwner, projectId: projectUploadMatch[1], type: input.type, filename: input.filename, content: input.content, mimeType: input.mimeType, zipExpandedBytes: input.zipExpandedBytes });
        await persistWorkspaceInput(storedInput);
        return json(response, 201, { service: HERO_SERVICE, input: storedInput });
      }

      const projectLinkMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})\/inputs\/link$/);
      if (projectLinkMatch && request.method === "POST") {
        const input = await readJson(request);
        const storedInput = projectWorkspace.registerLink({ actor: authenticatedOwner, projectId: projectLinkMatch[1], url: input.url, label: input.label });
        await persistWorkspaceInput(storedInput);
        return json(response, 201, { service: HERO_SERVICE, input: storedInput });
      }

      const projectFoundationMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})\/foundation$/);
      if (projectFoundationMatch && request.method === "GET") return json(response, 200, { service: HERO_SERVICE, proposal: projectWorkspace.foundationProposal({ projectId: projectFoundationMatch[1] }) });
      const projectFoundationReviseMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})\/foundation\/revise$/);
      if (projectFoundationReviseMatch && request.method === "POST") {
        const input = await readJson(request);
        const proposal = projectWorkspace.reviseFoundation({ actor: authenticatedOwner, projectId: projectFoundationReviseMatch[1], proposalId: input.proposalId, expectedVersion: input.expectedVersion, changes: input.changes, reason: input.reason });
        await persistWorkspaceProposal(proposal);
        return json(response, 200, { service: HERO_SERVICE, proposal });
      }
      const projectFoundationApproveMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})\/foundation\/approve$/);
      if (projectFoundationApproveMatch && request.method === "POST") {
        const input = await readJson(request);
        const proposal = projectWorkspace.approveFoundation({ actor: authenticatedOwner, projectId: projectFoundationApproveMatch[1], proposalId: input.proposalId, expectedVersion: input.expectedVersion });
        await persistWorkspaceProposal(proposal);
        await persistWorkspaceProject(projectWorkspace.getProject(projectFoundationApproveMatch[1]), "Foundation approved");
        await persistWorkspaceSettings(projectFoundationApproveMatch[1]);
        return json(response, 200, { service: HERO_SERVICE, proposal });
      }

      const projectImportMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})\/import\/github$/);
      if (projectImportMatch && request.method === "POST") {
        const input = await readJson(request);
        const importPlan = projectWorkspace.importGithubReadOnly({ actor: authenticatedOwner, projectId: projectImportMatch[1], repositoryUrl: input.repositoryUrl, inventory: input.inventory });
        await persistWorkspaceImport(importPlan);
        return json(response, 202, { service: HERO_SERVICE, importPlan });
      }

      const projectSettingsMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})\/settings$/);
      if (projectSettingsMatch && request.method === "GET") {
        return json(response, 200, { service: HERO_SERVICE, projectId: projectSettingsMatch[1], settings: projectSettings.effectiveProject({ projectId: projectSettingsMatch[1], runId: url.searchParams.get("runId") }) });
      }
      if (projectSettingsMatch && request.method === "POST") {
        const input = await readJson(request);
        const setting = projectSettings.setValue({ actor: authenticatedOwner, projectId: projectSettingsMatch[1], path: input.path, value: input.value, layer: input.layer, runId: input.runId ?? null, expectedVersion: input.expectedVersion ?? null, reason: input.reason, impact: input.impact, rollbackReference: input.rollbackReference });
        await persistWorkspaceSettings(projectSettingsMatch[1]);
        return json(response, 200, { service: HERO_SERVICE, setting });
      }
      const projectPolicyApplyMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})\/settings\/policy-pack\/apply$/);
      if (projectPolicyApplyMatch && request.method === "POST") {
        const input = await readJson(request);
        const settings = projectSettings.applyPolicyPack({ actor: authenticatedOwner, projectId: projectPolicyApplyMatch[1], reason: input.reason });
        await persistWorkspaceSettings(projectPolicyApplyMatch[1]);
        return json(response, 200, { service: HERO_SERVICE, settings });
      }
      const projectSettingRollbackMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})\/settings\/rollback$/);
      if (projectSettingRollbackMatch && request.method === "POST") {
        const input = await readJson(request);
        const setting = projectSettings.rollback({ actor: authenticatedOwner, projectId: projectSettingRollbackMatch[1], path: input.path, toVersion: input.toVersion, reason: input.reason });
        await persistWorkspaceSettings(projectSettingRollbackMatch[1]);
        return json(response, 200, { service: HERO_SERVICE, setting });
      }

      const projectWorkspaceOverviewMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})\/workspace-overview$/);
      if (projectWorkspaceOverviewMatch && request.method === "GET") return json(response, 200, { service: HERO_SERVICE, overview: projectOverview(projectWorkspaceOverviewMatch[1]) });

      const projectTeamsMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})\/teams$/);
      if (projectTeamsMatch && request.method === "GET") return json(response, 200, { service: HERO_SERVICE, teams: projectCollaboration.listTeams({ actor: authenticatedOwner, projectId: projectTeamsMatch[1] }) });
      if (projectTeamsMatch && request.method === "POST") { const input = await readJson(request); return json(response, 201, { service: HERO_SERVICE, assignment: projectCollaboration.assignTeam({ actor: authenticatedOwner, projectId: projectTeamsMatch[1], teamId: input.teamId, principles: input.principles, kpis: input.kpis }) }); }

      const projectConversationsMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})\/conversations$/);
      if (projectConversationsMatch && request.method === "POST") { const input = await readJson(request); return json(response, 201, { service: HERO_SERVICE, conversation: projectCollaboration.bindContext({ actor: authenticatedOwner, projectId: projectConversationsMatch[1], contextType: input.contextType, teamId: input.teamId, roleId: input.roleId, entityId: input.entityId, model: input.model, retentionDays: input.retentionDays }) }); }
      const projectConversationMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})\/conversations\/([A-Za-z][A-Za-z0-9._:-]{2,127})$/);
      if (projectConversationMatch && request.method === "GET") return json(response, 200, { service: HERO_SERVICE, conversation: projectCollaboration.readConversation({ actor: authenticatedOwner, projectId: projectConversationMatch[1], conversationId: projectConversationMatch[2] }) });
      const projectConversationMessageMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})\/conversations\/([A-Za-z][A-Za-z0-9._:-]{2,127})\/messages$/);
      if (projectConversationMessageMatch && request.method === "POST") { const input = await readJson(request); return json(response, 201, { service: HERO_SERVICE, message: projectCollaboration.appendMessage({ actor: authenticatedOwner, projectId: projectConversationMessageMatch[1], conversationId: projectConversationMessageMatch[2], content: input.content, citations: input.citations }) }); }

      const projectMemoryMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})\/memory$/);
      if (projectMemoryMatch && request.method === "GET") return json(response, 200, { service: HERO_SERVICE, memory: projectCollaboration.retrieveMemory({ actor: authenticatedOwner, projectId: projectMemoryMatch[1], level: url.searchParams.get("level"), query: url.searchParams.get("q") ?? "" }) });
      if (projectMemoryMatch && request.method === "POST") { const input = await readJson(request); return json(response, 201, { service: HERO_SERVICE, memory: projectCollaboration.recordMemory({ actor: authenticatedOwner, projectId: projectMemoryMatch[1], ...input }) }); }

      const projectCommandsMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})\/commands$/);
      if (projectCommandsMatch && request.method === "POST") { const input = await readJson(request); return json(response, 201, { service: HERO_SERVICE, command: commandCenter.createIntent({ actor: authenticatedOwner, projectId: projectCommandsMatch[1], ...input }) }); }
      const projectCommandAuthorizeMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})\/commands\/([A-Za-z][A-Za-z0-9._:-]{2,127})\/authorize$/);
      if (projectCommandAuthorizeMatch && request.method === "POST") { const input = await readJson(request); return json(response, 200, { service: HERO_SERVICE, command: commandCenter.authorize({ actor: authenticatedOwner, commandId: projectCommandAuthorizeMatch[2], authorizationSnapshotId: input.authorizationSnapshotId }) }); }
      const projectCommandApproveMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})\/commands\/([A-Za-z][A-Za-z0-9._:-]{2,127})\/approve$/);
      if (projectCommandApproveMatch && request.method === "POST") { const input = await readJson(request); return json(response, 200, { service: HERO_SERVICE, command: commandCenter.approve({ actor: authenticatedOwner, commandId: projectCommandApproveMatch[2], templateId: input.templateId, reason: input.reason }) }); }
      const projectCommandQueueMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})\/commands\/([A-Za-z][A-Za-z0-9._:-]{2,127})\/queue$/);
      if (projectCommandQueueMatch && request.method === "POST") { const input = await readJson(request); return json(response, 202, { service: HERO_SERVICE, queue: commandCenter.queue({ actor: authenticatedOwner, commandId: projectCommandQueueMatch[2], heavy: input.heavy, resourceClaim: input.resourceClaim, priority: input.priority }) }); }
      const projectOperationsMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})\/operations$/);
      if (projectOperationsMatch && request.method === "GET") return json(response, 200, { service: HERO_SERVICE, operations: commandCenter.operations({ actor: authenticatedOwner, projectId: projectOperationsMatch[1] }) });
      const projectDispatchMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})\/operations\/dispatch-next$/);
      if (projectDispatchMatch && request.method === "POST") return json(response, 202, { service: HERO_SERVICE, dispatch: commandCenter.dispatchNext({ actor: authenticatedOwner }) });
      const projectApprovalTemplateMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})\/approval-templates$/);
      if (projectApprovalTemplateMatch && request.method === "POST") { const input = await readJson(request); return json(response, 201, { service: HERO_SERVICE, template: commandCenter.createApprovalTemplate({ actor: authenticatedOwner, projectId: projectApprovalTemplateMatch[1], ...input }) }); }
      const projectProductionPreauthMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})\/production-preauthorizations$/);
      if (projectProductionPreauthMatch && request.method === "POST") { const input = await readJson(request); return json(response, 201, { service: HERO_SERVICE, preauthorization: commandCenter.preauthorizeProduction({ actor: authenticatedOwner, projectId: projectProductionPreauthMatch[1], ...input }) }); }

      const projectCatalogMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})\/catalog$/);
      if (projectCatalogMatch && request.method === "GET") return json(response, 200, { service: HERO_SERVICE, entities: systemCatalog.list({ projectId: projectCatalogMatch[1], type: url.searchParams.get("type") }) });
      if (projectCatalogMatch && request.method === "POST") { const input = await readJson(request); return json(response, 201, { service: HERO_SERVICE, entity: systemCatalog.register({ actor: authenticatedOwner, projectId: projectCatalogMatch[1], ...input }) }); }
      const projectCatalogSearchMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})\/catalog\/search$/);
      if (projectCatalogSearchMatch && request.method === "GET") return json(response, 200, { service: HERO_SERVICE, results: systemCatalog.search({ projectId: projectCatalogSearchMatch[1], query: url.searchParams.get("q") }) });
      const projectCatalogDriftMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})\/catalog\/drift$/);
      if (projectCatalogDriftMatch && request.method === "POST") { const input = await readJson(request); return json(response, 201, { service: HERO_SERVICE, proposal: systemCatalog.detectDrift({ actor: authenticatedOwner, projectId: projectCatalogDriftMatch[1], ...input }) }); }

      const projectUsageMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})\/usage$/);
      if (projectUsageMatch && request.method === "POST") { const input = await readJson(request); return json(response, 201, { service: HERO_SERVICE, usage: performanceIntelligence.recordUsage({ actor: authenticatedOwner, projectId: projectUsageMatch[1], ...input }) }); }
      const projectBudgetMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})\/budget$/);
      if (projectBudgetMatch && request.method === "POST") { const input = await readJson(request); return json(response, 200, { service: HERO_SERVICE, budget: performanceIntelligence.setBudget({ actor: authenticatedOwner, projectId: projectBudgetMatch[1], ...input }) }); }
      const projectLedgerMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})\/ledger$/);
      if (projectLedgerMatch && request.method === "GET") return json(response, 200, { service: HERO_SERVICE, ledger: performanceIntelligence.ledger({ actor: authenticatedOwner, projectId: projectLedgerMatch[1], groupBy: url.searchParams.get("groupBy") ?? "project" }) });
      const projectEvaluationMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})\/evaluations$/);
      if (projectEvaluationMatch && request.method === "POST") { const input = await readJson(request); return json(response, 201, { service: HERO_SERVICE, evaluation: performanceIntelligence.recordEvaluation({ actor: authenticatedOwner, projectId: projectEvaluationMatch[1], ...input }) }); }
      const projectHealthMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})\/health$/);
      if (projectHealthMatch && request.method === "GET") return json(response, 200, { service: HERO_SERVICE, health: performanceIntelligence.health({ actor: authenticatedOwner, projectId: projectHealthMatch[1] }) });

      const projectNotificationsMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})\/notifications$/);
      if (projectNotificationsMatch && request.method === "GET") return json(response, 200, { service: HERO_SERVICE, notifications: notificationObservability.inbox({ actor: authenticatedOwner, projectId: projectNotificationsMatch[1], view: url.searchParams.get("view") ?? "all" }) });
      if (projectNotificationsMatch && request.method === "POST") { const input = await readJson(request); return json(response, 201, { service: HERO_SERVICE, notification: notificationObservability.createNotification({ actor: authenticatedOwner, projectId: projectNotificationsMatch[1], ...input }) }); }
      const projectAuditMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})\/audit-log$/);
      if (projectAuditMatch && request.method === "GET") return json(response, 200, { service: HERO_SERVICE, audit: notificationObservability.audit({ actor: authenticatedOwner, projectId: projectAuditMatch[1], kind: url.searchParams.get("kind") }) });
      const projectObservabilityMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})\/observability$/);
      if (projectObservabilityMatch && request.method === "GET") return json(response, 200, { service: HERO_SERVICE, observability: notificationObservability.observability({ actor: authenticatedOwner, projectId: projectObservabilityMatch[1] }) });

      const projectInfrastructureMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})\/infrastructure$/);
      if (projectInfrastructureMatch && request.method === "GET") return json(response, 200, { service: HERO_SERVICE, infrastructure: infrastructureControl.view({ actor: authenticatedOwner, projectId: projectInfrastructureMatch[1] }) });
      if (projectInfrastructureMatch && request.method === "POST") { const input = await readJson(request); const projectId = projectInfrastructureMatch[1]; const actions = { "register-repository": () => infrastructureControl.registerRepository({ actor: authenticatedOwner, projectId, ...input }), "onboard-server": () => infrastructureControl.onboardServer({ actor: authenticatedOwner, projectId, ...input }), "connectivity-plan": () => infrastructureControl.connectivityPlan({ actor: authenticatedOwner, projectId, ...input }), "create-enrollment": () => infrastructureControl.createEnrollment({ actor: authenticatedOwner, projectId, ...input }), "rotate-node": () => infrastructureControl.rotateNodeIdentity({ actor: authenticatedOwner, projectId, ...input }), "revoke-node": () => infrastructureControl.revokeNode({ actor: authenticatedOwner, projectId, ...input }), "set-state": () => infrastructureControl.setState({ actor: authenticatedOwner, projectId, ...input }), "reconcile": () => infrastructureControl.reconcile({ actor: authenticatedOwner, projectId, ...input }), "register-secret-metadata": () => infrastructureControl.registerSecret({ actor: authenticatedOwner, projectId, ...input }), "request-secret-reveal": () => infrastructureControl.requestReveal({ actor: authenticatedOwner, projectId, ...input }), "set-egress-policy": () => infrastructureControl.setEgressPolicy({ actor: authenticatedOwner, projectId, ...input }) }; if (!actions[input.action]) throw new InfrastructureError("INFRASTRUCTURE_ACTION_INVALID", "Infrastructure action is invalid.", 400); return json(response, 201, { service: HERO_SERVICE, result: actions[input.action]() }); }

      const projectDeliveryMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})\/delivery$/);
      if (projectDeliveryMatch && request.method === "GET") return json(response, 200, { service: HERO_SERVICE, delivery: deliveryControl.view({ actor: authenticatedOwner, projectId: projectDeliveryMatch[1] }) });
      if (projectDeliveryMatch && request.method === "POST") { const input = await readJson(request); const projectId = projectDeliveryMatch[1]; const actions = { "ingest-telemetry": () => deliveryControl.ingestTelemetry({ actor: authenticatedOwner, projectId, ...input }), "request-break-glass": () => deliveryControl.requestBreakGlass({ actor: authenticatedOwner, projectId, ...input }), "create-release": () => deliveryControl.createRelease({ actor: authenticatedOwner, projectId, ...input }), "transition-release": () => deliveryControl.transitionRelease({ actor: authenticatedOwner, projectId, ...input }), "register-artifact": () => deliveryControl.registerArtifact({ actor: authenticatedOwner, projectId, ...input }), "delivery-matrix": () => deliveryControl.deliveryMatrix({ actor: authenticatedOwner, projectId, ...input }), "create-bundle": () => deliveryControl.createBundle({ actor: authenticatedOwner, projectId, ...input }), "verify-portability": () => deliveryControl.verifyPortability({ actor: authenticatedOwner, projectId, ...input }), "rehearse-recovery": () => deliveryControl.rehearseRecovery({ actor: authenticatedOwner, projectId, ...input }), accept: () => deliveryControl.accept({ actor: authenticatedOwner, projectId, ...input }) }; if (!actions[input.action]) throw new DeliveryError("DELIVERY_ACTION_INVALID", "Delivery action is invalid.", 400); return json(response, 201, { service: HERO_SERVICE, result: actions[input.action]() }); }

      const projectHardeningMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})\/hardening$/);
      if (projectHardeningMatch && request.method === "GET") return json(response, 200, { service: HERO_SERVICE, hardening: operationalHardening.report({ actor: authenticatedOwner, projectId: projectHardeningMatch[1] }) });
      if (projectHardeningMatch && request.method === "POST") { const input = await readJson(request); const projectId = projectHardeningMatch[1]; const actions = { "set-retention": () => operationalHardening.setRetention({ actor: authenticatedOwner, projectId, ...input }), "plan-cleanup": () => operationalHardening.planCleanup({ actor: authenticatedOwner, projectId, ...input }), "set-locale": () => operationalHardening.locale({ actor: authenticatedOwner, projectId, ...input }), "record-audit": () => operationalHardening.recordAudit({ actor: authenticatedOwner, projectId, ...input }) }; if (!actions[input.action]) throw new HardeningError("HARDENING_ACTION_INVALID", "Hardening action is invalid.", 400); return json(response, 201, { service: HERO_SERVICE, result: actions[input.action]() }); }

      const projectReadinessMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})\/final-readiness$/);
      if (projectReadinessMatch && request.method === "GET") return json(response, 200, { service: HERO_SERVICE, readiness: finalReadiness.view({ actor: authenticatedOwner, projectId: projectReadinessMatch[1] }) });
      if (projectReadinessMatch && request.method === "POST") { const input = await readJson(request); const projectId = projectReadinessMatch[1]; const actions = { "plan-migration": () => finalReadiness.planMigration({ actor: authenticatedOwner, projectId, ...input }), "rebuild-read-model": () => finalReadiness.rebuildReadModel({ actor: authenticatedOwner, projectId, ...input }), "record-scenario": () => finalReadiness.recordScenario({ actor: authenticatedOwner, projectId, ...input }), "set-traceability": () => finalReadiness.setTraceability({ actor: authenticatedOwner, projectId, ...input }), "prepare-notion-projection": () => finalReadiness.prepareNotionProjection({ actor: authenticatedOwner, projectId, ...input }), "readiness-review": () => finalReadiness.readinessReview({ actor: authenticatedOwner, projectId, ...input }), accept: () => finalReadiness.accept({ actor: authenticatedOwner, projectId, ...input }), "pilot-proposal": () => finalReadiness.pilotProposal({ actor: authenticatedOwner, projectId, ...input }) }; if (!actions[input.action]) throw new FinalReadinessError("READINESS_ACTION_INVALID", "Readiness action is invalid.", 400); return json(response, 201, { service: HERO_SERVICE, result: actions[input.action]() }); }

      const projectAccessMatch = url.pathname.match(/^\/api\/projects\/([A-Za-z][A-Za-z0-9._:-]{2,127})\/access$/);
      if (projectAccessMatch && request.method === "GET") {
        if (!projectAccessRegistry) throw new HumanIdentityError("IDENTITY_NOT_CONFIGURED", "Project identity is not configured.", 503);
        const projectId = projectAccessMatch[1];
        return json(response, 200, { service: HERO_SERVICE, projectId, grants: projectAccessRegistry.listProjectGrants({ principal: authenticatedOwner, projectId }) });
      }

      if (projectAccessMatch && request.method === "POST") {
        if (!projectAccessRegistry) throw new HumanIdentityError("IDENTITY_NOT_CONFIGURED", "Project identity is not configured.", 503);
        const input = await readJson(request);
        if (input.role === "admin" && humanIdentity) {
          const user = humanIdentity.getUser(input.userId);
          if (!user?.mfaEnabled) throw new HumanIdentityError("MFA_REQUIRED", "An admin ProjectGrant requires enrolled MFA before it can be granted.", 409);
        }
        const grant = projectAccessRegistry.upsertGrant({ actor: authenticatedOwner, grant: { projectId: projectAccessMatch[1], userId: input.userId, role: input.role } });
        if (grant.role === "admin" && humanIdentity) {
          humanIdentity.setMfaRequired({ actor: authenticatedOwner, userId: grant.userId, required: true });
          await persistIdentityUser(grant.userId);
        }
        if (postgresRuntime?.projectIdentity?.appendGrant) await postgresRuntime.projectIdentity.appendGrant({ projectId: grant.projectId, userId: grant.userId, role: grant.role, status: grant.status, grantedBy: authenticatedOwner.subject });
        await persistIdentityAudit({ userId: grant.userId, eventType: "identity.project-grant-upserted", data: { projectId: grant.projectId, role: grant.role, grantedBy: authenticatedOwner.subject } });
        return json(response, 201, { service: HERO_SERVICE, grant });
      }

      const projectAccessRevokeMatch = url.pathname.match(/^\/api\/projects\/([A-Za-z][A-Za-z0-9._:-]{2,127})\/access\/revoke$/);
      if (projectAccessRevokeMatch && request.method === "POST") {
        if (!projectAccessRegistry) throw new HumanIdentityError("IDENTITY_NOT_CONFIGURED", "Project identity is not configured.", 503);
        const input = await readJson(request);
        const grant = projectAccessRegistry.revokeGrant({ actor: authenticatedOwner, projectId: projectAccessRevokeMatch[1], userId: input.userId });
        if (postgresRuntime?.projectIdentity?.appendGrant) await postgresRuntime.projectIdentity.appendGrant({ projectId: grant.projectId, userId: grant.userId, role: grant.role, status: "revoked", grantedBy: authenticatedOwner.subject });
        await persistIdentityAudit({ userId: grant.userId, eventType: "identity.project-grant-revoked", data: { projectId: grant.projectId, revokedBy: authenticatedOwner.subject } });
        return json(response, 200, { service: HERO_SERVICE, grant });
      }

      const projectOverviewMatch = url.pathname.match(/^\/api\/projects\/([A-Za-z][A-Za-z0-9._:-]{2,127})\/overview$/);
      if (projectOverviewMatch && request.method === "GET") {
        if (!projectAccessMiddleware) throw new HumanIdentityError("IDENTITY_NOT_CONFIGURED", "Project identity is not configured.", 503);
        const scope = projectAccessMiddleware.requireProject({ principal: authenticatedOwner, projectId: projectOverviewMatch[1], action: "project.read" });
        return json(response, 200, { service: HERO_SERVICE, projectId: projectOverviewMatch[1], access: scope, state: "project-read-model-not-yet-populated" });
      }

      if (request.method === "GET" && url.pathname === "/") {
        return html(response, getDashboardHtml());
      }

      if (request.method === "GET" && url.pathname === "/api/dashboard") {
        return json(response, 200, { service: HERO_SERVICE, dashboard: dashboard.snapshot() });
      }

      if (request.method === "GET" && url.pathname === "/api/product-development/contract") {
        return json(response, 200, { service: HERO_SERVICE, productDevelopmentContract: getProductDevelopmentContractSummary() });
      }

      if (request.method === "GET" && url.pathname === "/api/product-development/catalog") {
        return json(response, 200, { service: HERO_SERVICE, catalog: productStudioSnapshot() }, { maxBytes: backofficeResponseLimitBytes });
      }

      if (request.method === "GET" && url.pathname === "/api/product-development/search") {
        const query = url.searchParams.get("q") ?? "";
        const productId = url.searchParams.get("productId") ?? undefined;
        return json(response, 200, { service: HERO_SERVICE, query, results: productDevelopment.search({ query, productId }) });
      }

      const productDocumentMatch = url.pathname.match(/^\/api\/product-development\/documents\/([A-Z][A-Z0-9._:-]{2,127})$/);
      if (request.method === "GET" && productDocumentMatch) {
        return json(response, 200, { service: HERO_SERVICE, document: productDevelopment.document(productDocumentMatch[1]) }, { maxBytes: backofficeResponseLimitBytes });
      }

      if (request.method === "GET" && url.pathname === "/api/product-development/proposals") {
        return json(response, 200, { service: HERO_SERVICE, proposals: productDevelopment.listChangeProposals() });
      }

      if (request.method === "POST" && url.pathname === "/api/product-development/proposals") {
        const input = await readJson(request);
        const proposal = productDevelopment.createChangeProposal(input);
        return json(response, 201, { service: HERO_SERVICE, proposal });
      }

      if (request.method === "GET" && url.pathname === "/api/operations/diagnostics") {
        return json(response, 200, { service: HERO_SERVICE, diagnostics: dashboard.operationalDiagnostics() });
      }

      if (request.method === "GET" && url.pathname === "/api/ai-orchestration") {
        return json(response, 200, { service: HERO_SERVICE, aiOrchestration: dashboard.aiOrchestrationSnapshot() });
      }

      if (request.method === "GET" && url.pathname === "/api/ai/events") {
        const after = Number(url.searchParams.get("after") ?? "0");
        if (!Number.isInteger(after) || after < 0) return json(response, 400, { error: { code: "INVALID_AFTER", message: "after must be a non-negative integer." } });
        return json(response, 200, { service: HERO_SERVICE, events: dashboard.aiOrchestrationEvents(after) });
      }

      if (request.method === "GET" && url.pathname === "/api/ai/benchmarks") {
        return json(response, 200, { service: HERO_SERVICE, benchmark: dashboard.benchmarkSnapshot(), source: postgresRuntime?.benchmarkStore ? "postgresql" : "in-memory" });
      }

      if (request.method === "GET" && url.pathname === "/api/ai/benchmarks/compare") {
        const rawIds = url.searchParams.get("ids");
        const benchmarkIds = rawIds ? rawIds.split(",").map(value => value.trim()).filter(Boolean) : undefined;
        const limit = Number(url.searchParams.get("limit") ?? "50");
        if (!Number.isInteger(limit) || limit < 1 || limit > 100 || (benchmarkIds && (benchmarkIds.length < 1 || benchmarkIds.length > 100))) {
          throw new DashboardCommandError("INVALID_INPUT", "پارامترهای مقایسهٔ Benchmark معتبر نیستند.");
        }
        return json(response, 200, { service: HERO_SERVICE, comparison: await dashboard.compareBenchmarks({ benchmarkIds, limit }) });
      }

      const rolePolicyHistoryMatch = url.pathname.match(/^\/api\/ai\/role-policies\/([a-z][a-z0-9-]{2,63})\/history$/);
      if (request.method === "GET" && rolePolicyHistoryMatch) {
        return json(response, 200, { service: HERO_SERVICE, history: dashboard.aiRolePolicyHistory(rolePolicyHistoryMatch[1]) });
      }

      if (request.method === "GET" && url.pathname === "/api/ai/skills") {
        return json(response, 200, { service: HERO_SERVICE, skills: dashboard.skillSnapshot() });
      }

      if (request.method === "GET" && url.pathname === "/api/ai/organization-advisor") {
        return json(response, 200, { service: HERO_SERVICE, advisor: dashboard.organizationAdvisorSnapshot() });
      }

      if (request.method === "POST" && url.pathname === "/api/memory") {
        const input = await readJson(request);
        const result = await executeDashboardCommand("memory.record", input, () => dashboard.recordProjectMemory(input));
        return json(response, 201, { service: HERO_SERVICE, result });
      }

      if (request.method === "POST" && url.pathname === "/api/ai/context") {
        const input = await readJson(request);
        const result = await executeDashboardCommand("ai.context-assemble", input, () => dashboard.assembleAiContext(input));
        return json(response, 200, { service: HERO_SERVICE, result });
      }

      const aiCommandRoutes = {
        "/api/ai/providers": ["registerAiProvider", 201, "ai.provider-register"],
        "/api/ai/models": ["registerAiModel", 201, "ai.model-register"],
        "/api/ai/profiles": ["registerAiProfile", 201, "ai.profile-register"],
        "/api/ai/bindings": ["bindAiRole", 201, "ai.binding-create"],
        "/api/ai/skills": ["registerAiSkill", 201, "ai.skill-register"],
        "/api/ai/skill-bindings": ["bindAiSkill", 201, "ai.skill-binding-create"],
        "/api/ai/role-policies": ["setAiRolePolicy", 201, "ai.role-policy-update"],
        "/api/ai/invocations": ["invokeAi", 201, "ai.invoke"],
        "/api/ai/evaluations": ["recordAiEvaluation", 201, "ai.evaluation-record"],
        "/api/ai/evaluations/from-invocation": ["evaluateAiInvocation", 201, "ai.evaluation-from-invocation"],
        "/api/ai/decisions": ["proposeAiDecision", 201, "ai.decision-propose"],
        "/api/ai/organization-evaluations": ["reviewOrganizationPerformance", 201, "ai.organization-evaluation"],
        "/api/ai/organization-advisor": ["adviseOrganization", 201, "ai.organization-advisor"]
      };
      const rolePolicyRollbackMatch = url.pathname.match(/^\/api\/ai\/role-policies\/([a-z][a-z0-9-]{2,63})\/rollback$/);
      if (request.method === "POST" && rolePolicyRollbackMatch) {
        const input = await readJson(request);
        const role = rolePolicyRollbackMatch[1];
        const commandInput = { ...input, actor: authenticatedOwner.actor };
        const result = await executeDashboardCommand("ai.role-policy-rollback", commandInput, () => dashboard.rollbackAiRolePolicy(role, commandInput), authenticatedOwner.actor);
        return json(response, 200, { service: HERO_SERVICE, result });
      }
      if (request.method === "POST" && url.pathname === "/api/ai/benchmarks/synthetic") {
        const input = await readJson(request);
        const result = await executeDashboardCommand("ai.benchmark.synthetic", input, () => dashboard.runSyntheticBenchmark(input));
        return json(response, 201, { service: HERO_SERVICE, result });
      }
      if (request.method === "POST" && aiCommandRoutes[url.pathname]) {
        const input = await readJson(request);
        const [command, statusCode, auditCommand] = aiCommandRoutes[url.pathname];
        const commandInput = { ...input, actor: authenticatedOwner.actor };
        const result = await executeDashboardCommand(auditCommand, commandInput, () => dashboard[command](commandInput), authenticatedOwner.actor);
        return json(response, statusCode, { service: HERO_SERVICE, result });
      }

      const aiDecisionResolveMatch = url.pathname.match(/^\/api\/ai\/decisions\/([A-Za-z][A-Za-z0-9._:-]{2,127})\/resolve$/);
      if (request.method === "POST" && aiDecisionResolveMatch) {
        const input = await readJson(request);
        const decisionId = aiDecisionResolveMatch[1];
        const result = await executeDashboardCommand("ai.decision-resolve", input, () => dashboard.resolveAiDecision(decisionId, input));
        return json(response, 200, { service: HERO_SERVICE, result });
      }

      if (request.method === "GET" && url.pathname === "/api/teams") {
        return json(response, 200, { service: HERO_SERVICE, teamControl: dashboard.teamSnapshot() });
      }

      const teamContractHistoryMatch = url.pathname.match(/^\/api\/teams\/([a-z][a-z0-9-]{2,63})\/contract-history$/);
      if (request.method === "GET" && teamContractHistoryMatch) {
        return json(response, 200, { service: HERO_SERVICE, history: dashboard.teamContractHistory(teamContractHistoryMatch[1]) });
      }

      if (request.method === "GET" && url.pathname === "/team-principles") {
        const teamControl = dashboard.teamSnapshot();
        return json(response, 200, {
          service: HERO_SERVICE,
          teamPrinciples: teamControl.teams.map(team => ({
            teamId: team.teamId,
            name: team.name,
            responsibility: team.responsibility,
            principles: team.principles,
            approval: team.approvals.principles ? "approved" : "pending-owner-review",
            knowledge: team.knowledge,
            knowledgeVersion: team.knowledgeVersion
          }))
        });
      }

      const teamResearchCollectionMatch = url.pathname.match(/^\/api\/teams\/([a-z][a-z0-9-]{2,63})\/research-requests$/);
      if (teamResearchCollectionMatch && request.method === "GET") {
        return json(response, 200, { service: HERO_SERVICE, research: dashboard.listTeamResearch(teamResearchCollectionMatch[1]) });
      }
      if (teamResearchCollectionMatch && request.method === "POST") {
        const input = await readJson(request);
        const result = await executeDashboardCommand("team.research-request", { ...input, teamId: teamResearchCollectionMatch[1] }, () => dashboard.requestTeamResearch(teamResearchCollectionMatch[1], input));
        return json(response, 201, { service: HERO_SERVICE, result });
      }

      const teamTrainingMatch = url.pathname.match(/^\/api\/teams\/([a-z][a-z0-9-]{2,63})\/training-plan$/);
      if (request.method === "GET" && teamTrainingMatch) {
        return json(response, 200, { service: HERO_SERVICE, training: dashboard.teamTrainingPlan(teamTrainingMatch[1]) });
      }

      if (request.method === "POST" && url.pathname === "/api/plans") {
        const input = await readJson(request);
        const plan = await executeDashboardCommand("planning.create", input, () => dashboard.createPlan(input));
        return json(response, 201, { service: HERO_SERVICE, plan });
      }

      if (request.method === "POST" && url.pathname === "/api/pilots/dry-run") {
        const input = await readJson(request);
        const result = await executeDashboardCommand("pilot.dry-run", input, () => dashboard.runPilotDryRun(input));
        return json(response, 201, { service: HERO_SERVICE, result });
      }

      const outputDecisionMatch = url.pathname.match(/^\/api\/plans\/([A-Za-z][A-Za-z0-9._:-]{2,127})\/output-decision$/);
      if (request.method === "POST" && outputDecisionMatch) {
        const input = await readJson(request);
        const planningId = outputDecisionMatch[1];
        const plan = await executeDashboardCommand("planning.output-decision", input, () => dashboard.decidePlanOutput(planningId, input));
        return json(response, 200, { service: HERO_SERVICE, plan });
      }

      const researchActionMatch = url.pathname.match(/^\/api\/research\/([A-Z][A-Z0-9._:-]{2,127})(?:\/(start|report|review))?$/);
      if (researchActionMatch && request.method === "GET" && !researchActionMatch[2]) {
        return json(response, 200, { service: HERO_SERVICE, research: dashboard.getTeamResearch(researchActionMatch[1]) });
      }
      if (researchActionMatch && request.method === "POST" && researchActionMatch[2]) {
        const input = await readJson(request);
        const researchId = researchActionMatch[1];
        const action = researchActionMatch[2];
        const commands = {
          start: dashboard.startTeamResearch,
          report: dashboard.submitTeamResearchReport,
          review: dashboard.reviewTeamResearch
        };
        const result = await executeDashboardCommand(`team.research-${action}`, input, () => commands[action](researchId, input));
        return json(response, action === "report" ? 201 : 200, { service: HERO_SERVICE, result });
      }

      const planMatch = url.pathname.match(/^\/api\/plans\/([A-Za-z][A-Za-z0-9._:-]{2,127})$/);
      if (request.method === "GET" && planMatch) {
        return json(response, 200, { service: HERO_SERVICE, plan: dashboard.getPlan(planMatch[1]) });
      }

      if (request.method === "GET" && url.pathname === "/api/audit") {
        if (!postgresRuntime?.store) {
          return json(response, 503, { service: HERO_SERVICE, status: "persistence_unavailable", code: "PERSISTENCE_NOT_CONFIGURED" });
        }
        const after = Number(url.searchParams.get("after") ?? "0");
        if (!Number.isInteger(after) || after < 0) throw new DashboardCommandError("INVALID_INPUT", "مقدار after معتبر نیست.");
        const events = await postgresRuntime.store.readAfter(after);
        return json(response, 200, { service: HERO_SERVICE, events, nextAfter: events.at(-1)?.sequence ?? after });
      }

      const projectPrinciplesMatch = url.pathname.match(/^\/api\/projects\/([A-Za-z][A-Za-z0-9._:-]{2,127})\/principles$/);
      if (request.method === "GET" && projectPrinciplesMatch) {
        return json(response, 200, { service: HERO_SERVICE, principlesControl: dashboard.projectPrinciples(projectPrinciplesMatch[1]) });
      }

      if (request.method === "GET" && url.pathname === "/principles-contract") {
        return json(response, 200, { service: HERO_SERVICE, principlesContract: getCriticalPrinciplesContractSummary() });
      }

      if (request.method === "GET" && url.pathname === "/release-contract") {
        return json(response, 200, { service: HERO_SERVICE, releaseContract: getReleaseContractSummary() });
      }

      if (request.method === "GET" && url.pathname === "/owner-auth-contract") {
        return json(response, 200, { service: HERO_SERVICE, ownerAuthContract: getOwnerAuthContractSummary() });
      }

      if (request.method === "GET" && url.pathname === "/admin-auth-contract") {
        return json(response, 200, { service: HERO_SERVICE, adminAuthContract: getAdminAuthContractSummary() });
      }

      if (request.method === "GET" && url.pathname === "/project-identity-contract") {
        return json(response, 200, { service: HERO_SERVICE, projectIdentityContract: getProjectIdentityContractSummary() });
      }

      if (request.method === "GET" && url.pathname === "/project-workspace-contract") {
        return json(response, 200, { service: HERO_SERVICE, projectWorkspaceContract: getProjectWorkspaceContractSummary() });
      }

      if (request.method === "GET" && url.pathname === "/project-settings-contract") {
        return json(response, 200, { service: HERO_SERVICE, projectSettingsContract: getProjectSettingsContractSummary() });
      }

      if (request.method === "GET" && url.pathname === "/backoffice-collaboration-contract") return json(response, 200, { service: HERO_SERVICE, collaborationContract: getBackofficeCollaborationContractSummary() });
      if (request.method === "GET" && url.pathname === "/backoffice-command-center-contract") return json(response, 200, { service: HERO_SERVICE, commandCenterContract: getBackofficeCommandCenterContractSummary() });
      if (request.method === "GET" && url.pathname === "/system-catalog-contract") return json(response, 200, { service: HERO_SERVICE, systemCatalogContract: getSystemCatalogContractSummary() });
      if (request.method === "GET" && url.pathname === "/performance-intelligence-contract") return json(response, 200, { service: HERO_SERVICE, performanceIntelligenceContract: getPerformanceIntelligenceContractSummary() });
      if (request.method === "GET" && url.pathname === "/notification-observability-contract") return json(response, 200, { service: HERO_SERVICE, notificationObservabilityContract: getNotificationObservabilityContractSummary() });
      if (request.method === "GET" && url.pathname === "/infrastructure-control-contract") return json(response, 200, { service: HERO_SERVICE, infrastructureControlContract: getInfrastructureControlContractSummary() });
      if (request.method === "GET" && url.pathname === "/delivery-control-contract") return json(response, 200, { service: HERO_SERVICE, deliveryControlContract: getDeliveryControlContractSummary() });
      if (request.method === "GET" && url.pathname === "/operational-hardening-contract") return json(response, 200, { service: HERO_SERVICE, operationalHardeningContract: getOperationalHardeningContractSummary() });
      if (request.method === "GET" && url.pathname === "/final-readiness-contract") return json(response, 200, { service: HERO_SERVICE, finalReadinessContract: getFinalReadinessContractSummary() });

      if (request.method === "GET" && url.pathname === "/ai-orchestration-contract") {
        return json(response, 200, { service: HERO_SERVICE, aiOrchestrationContract: getAiOrchestrationContractSummary() });
      }

      if (request.method === "GET" && url.pathname === "/skill-contract") {
        return json(response, 200, { service: HERO_SERVICE, skillContract: getSkillContractSummary() });
      }

      if (request.method === "GET" && url.pathname === "/organization-advisor-contract") {
        return json(response, 200, { service: HERO_SERVICE, organizationAdvisorContract: getOrganizationAdvisorContractSummary() });
      }

      if (request.method === "GET" && url.pathname === "/ai-benchmark-contract") {
        return json(response, 200, { service: HERO_SERVICE, aiBenchmarkContract: getAiBenchmarkContractSummary() });
      }

      if (request.method === "GET" && url.pathname === "/organization-performance-contract") {
        return json(response, 200, { service: HERO_SERVICE, organizationPerformanceContract: getOrganizationPerformanceContractSummary() });
      }

      if (request.method === "GET" && url.pathname === "/observability-contract") {
        return json(response, 200, { service: HERO_SERVICE, observabilityContract: getObservabilityContractSummary() });
      }

      if (request.method === "GET" && url.pathname === "/pilot-contract") {
        return json(response, 200, { service: HERO_SERVICE, pilotContract: getPilotContractSummary() });
      }

      if (request.method === "POST" && url.pathname === "/api/requests") {
        const input = await readJson(request);
        const created = await executeDashboardCommand("request.create", input, () => dashboard.createRequest(input));
        return json(response, 201, { service: HERO_SERVICE, request: created });
      }

      const actionMatch = url.pathname.match(/^\/api\/requests\/(REQ-\d{3})\/(approve|reject|stop|run)$/);
      if (request.method === "POST" && actionMatch) {
        const input = await readJson(request);
        const [, requestId, action] = actionMatch;
        const requestByAction = {
          approve: dashboard.approveRequest,
          reject: dashboard.rejectRequest,
          stop: dashboard.stopRequest,
          run: dashboard.runFakeAgent
        };
        const result = await executeDashboardCommand(`request.${action}`, input, () => requestByAction[action](requestId));
        return json(response, 200, { service: HERO_SERVICE, request: result });
      }

      if (request.method === "POST" && url.pathname === "/api/authority") {
        const input = await readJson(request);
        const result = await executeDashboardCommand("authority.update", input, () => dashboard.setFullAutonomy(input.fullAutonomy));
        return json(response, 200, { service: HERO_SERVICE, dashboard: result });
      }

      if (request.method === "POST" && url.pathname === "/api/global-stop") {
        const input = await readJson(request);
        const result = await executeDashboardCommand("global-stop.update", input, () => dashboard.setGlobalStop(input.active));
        return json(response, 200, { service: HERO_SERVICE, dashboard: result });
      }

      const principleDefinitionMatch = url.pathname.match(/^\/api\/projects\/([A-Za-z][A-Za-z0-9._:-]{2,127})\/principles$/);
      if (request.method === "POST" && principleDefinitionMatch) {
        const input = await readJson(request);
        const projectId = principleDefinitionMatch[1];
        const result = await executeDashboardCommand("principle.define", { ...input, projectId }, () => dashboard.defineProjectPrinciple(projectId, input));
        return json(response, 201, { service: HERO_SERVICE, result });
      }

      const principleActionMatch = url.pathname.match(/^\/api\/projects\/([A-Za-z][A-Za-z0-9._:-]{2,127})\/principles\/([A-Za-z][A-Za-z0-9._:-]{2,127})\/(review|rework)$/);
      if (request.method === "POST" && principleActionMatch) {
        const input = await readJson(request);
        const [, projectId, principleId, action] = principleActionMatch;
        const command = action === "review" ? dashboard.reviewProjectPrinciple : dashboard.requestProjectPrincipleRework;
        const result = await executeDashboardCommand(`principle.${action}`, { ...input, projectId }, () => command(projectId, principleId, input));
        return json(response, 200, { service: HERO_SERVICE, result });
      }

      const principleCheckMatch = url.pathname.match(/^\/api\/projects\/([A-Za-z][A-Za-z0-9._:-]{2,127})\/principles\/check$/);
      if (request.method === "POST" && principleCheckMatch) {
        const input = await readJson(request);
        return json(response, 200, { service: HERO_SERVICE, result: dashboard.checkProjectPrinciples(principleCheckMatch[1], input.controlPoint) });
      }

      if (request.method === "POST" && url.pathname === "/api/releases") {
        const input = await readJson(request);
        const result = await executeDashboardCommand("release.register", input, () => dashboard.registerRelease(input));
        return json(response, 201, { service: HERO_SERVICE, result });
      }

      const releaseActionMatch = url.pathname.match(/^\/api\/releases\/([A-Za-z][A-Za-z0-9._:-]{2,127})\/(test-deployment|test-deployment-record|test-evidence|production-approval|production-approve|production-promote|rollback)$/);
      if (request.method === "POST" && releaseActionMatch) {
        const input = await readJson(request);
        const [, releaseId, action] = releaseActionMatch;
        const releaseByAction = {
          "test-deployment": dashboard.requestTestDeployment,
          "test-deployment-record": dashboard.recordTestDeployment,
          "test-evidence": dashboard.recordTestEvidence,
          "production-approval": dashboard.requestProductionApproval,
          "production-approve": dashboard.approveProduction,
          "production-promote": dashboard.requestProductionPromotion,
          rollback: dashboard.rollbackRelease
        };
        const result = await executeDashboardCommand(`release.${action}`, input, () => releaseByAction[action]({ ...input, releaseId }));
        return json(response, 200, { service: HERO_SERVICE, result });
      }

      const teamMatch = url.pathname.match(/^\/api\/teams\/([a-z][a-z0-9-]{2,63})\/(review|rework|principles|deliverable-review|autonomy|training|assign|split)$/);
      if (request.method === "POST" && teamMatch) {
        const input = await readJson(request);
        const [, teamId, action] = teamMatch;
        const teamByAction = {
          review: dashboard.reviewTeam,
          rework: dashboard.requestTeamRework,
          principles: dashboard.updateTeamPrinciples,
          "deliverable-review": dashboard.reviewTeamDeliverable,
          autonomy: dashboard.setTeamAutonomy,
          training: dashboard.recordTeamTraining,
          assign: dashboard.assignTeam,
          split: dashboard.splitTeam
        };
        const actor = action === "principles" ? authenticatedOwner.actor : undefined;
        const result = await executeDashboardCommand(`team.${action}`, input, () => teamByAction[action](teamId, input, actor), actor);
        return json(response, 200, { service: HERO_SERVICE, result });
      }

      const teamPrinciplesRollbackMatch = url.pathname.match(/^\/api\/teams\/([a-z][a-z0-9-]{2,63})\/principles\/rollback$/);
      if (request.method === "POST" && teamPrinciplesRollbackMatch) {
        const input = await readJson(request);
        const teamId = teamPrinciplesRollbackMatch[1];
        const result = await executeDashboardCommand("team.principles-rollback", { ...input, teamId }, () => dashboard.rollbackTeamPrinciples(teamId, input, authenticatedOwner.actor), authenticatedOwner.actor);
        return json(response, 200, { service: HERO_SERVICE, result });
      }

      if (request.method === "POST" && url.pathname === "/api/teams/merge") {
        const input = await readJson(request);
        const result = await executeDashboardCommand("team.merge", input, () => dashboard.mergeTeams(input));
        return json(response, 200, { service: HERO_SERVICE, result });
      }

      const assignmentMatch = url.pathname.match(/^\/api\/team-assignments\/([^/]+)\/update$/);
      if (request.method === "POST" && assignmentMatch) {
        const input = await readJson(request);
        const result = await executeDashboardCommand("team-assignment.update", input, () => dashboard.updateTeamAssignment(assignmentMatch[1], input));
        return json(response, 200, { service: HERO_SERVICE, result });
      }

      const workflowMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/team-workflow$/);
      if (request.method === "POST" && workflowMatch) {
        const input = await readJson(request);
        const projectId = workflowMatch[1];
        const result = await executeDashboardCommand("team-workflow.configure", { ...input, projectId }, () => dashboard.configureTeamWorkflow(projectId, input));
        return json(response, 200, { service: HERO_SERVICE, result });
      }

    if (request.method === "GET" && url.pathname === "/health") {
      return json(response, 200, {
        service: HERO_SERVICE,
        version: HERO_VERSION,
        status: "ok"
      });
    }

    if (request.method === "GET" && url.pathname === "/ready") {
      if (requirePostgres && !postgresRuntime) {
        return json(response, 503, {
          service: HERO_SERVICE,
          status: "not_ready",
          code: "PERSISTENCE_NOT_CONFIGURED",
          boundary: "clean-room",
          persistence: "postgresql-required"
        });
      }
      return json(response, 200, {
        service: HERO_SERVICE,
        status: "ready",
        boundary: "clean-room",
        persistence: postgresRuntime ? "postgresql" : "in-memory"
      });
    }

    if (request.method === "GET" && url.pathname === "/architecture") {
      return json(response, 200, {
        service: HERO_SERVICE,
        architecture: getPublicArchitectureSummary()
      });
    }

    if (request.method === "GET" && url.pathname === "/data-contract") {
      return json(response, 200, {
        service: HERO_SERVICE,
        dataContract: getOperationalDataSummary()
      });
    }

    if (request.method === "GET" && url.pathname === "/workflow-contract") {
      return json(response, 200, {
        service: HERO_SERVICE,
        workflowContract: getWorkflowContractSummary()
      });
    }

    if (request.method === "GET" && url.pathname === "/authorization-contract") {
      return json(response, 200, {
        service: HERO_SERVICE,
        authorizationContract: getAuthorizationContractSummary()
      });
    }

    if (request.method === "GET" && url.pathname === "/runner-contract") {
      return json(response, 200, {
        service: HERO_SERVICE,
        runnerContract: getRunnerContractSummary()
      });
    }

    if (request.method === "GET" && url.pathname === "/fake-agent-contract") {
      return json(response, 200, {
        service: HERO_SERVICE,
        fakeAgentContract: getFakeAgentContractSummary()
      });
    }

    if (request.method === "GET" && url.pathname === "/provider-agent-contract") {
      return json(response, 200, {
        service: HERO_SERVICE,
        providerAgentContract: getProviderAgentContractSummary()
      });
    }

    if (request.method === "GET" && url.pathname === "/claude-review-contract") {
      return json(response, 200, {
        service: HERO_SERVICE,
        claudeReviewContract: getClaudeReviewContractSummary()
      });
    }

    if (request.method === "GET" && url.pathname === "/cursor-handoff-contract") {
      return json(response, 200, {
        service: HERO_SERVICE,
        cursorHandoffContract: getCursorHandoffContractSummary()
      });
    }

    if (request.method === "GET" && url.pathname === "/project-memory-contract") {
      return json(response, 200, {
        service: HERO_SERVICE,
        projectMemoryContract: getProjectMemoryContractSummary()
      });
    }

    if (request.method === "GET" && url.pathname === "/planner-contract") {
      return json(response, 200, {
        service: HERO_SERVICE,
        plannerContract: getPlannerContractSummary()
      });
    }

    if (request.method === "GET" && url.pathname === "/quality-gate-contract") {
      return json(response, 200, {
        service: HERO_SERVICE,
        qualityGateContract: getQualityGateContractSummary()
      });
    }

    if (request.method === "GET" && url.pathname === "/web-factory-contract") {
      return json(response, 200, {
        service: HERO_SERVICE,
        webFactoryContract: getWebFactoryContractSummary()
      });
    }

    if (request.method === "GET" && url.pathname === "/mobile-factory-contract") {
      return json(response, 200, {
        service: HERO_SERVICE,
        mobileFactoryContract: getMobileFactoryContractSummary()
      });
    }

    if (request.method === "GET" && url.pathname === "/assurance-gate-contract") {
      return json(response, 200, {
        service: HERO_SERVICE,
        assuranceGateContract: getAssuranceGateContractSummary()
      });
    }

    if (request.method === "GET" && url.pathname === "/portability-gate-contract") {
      return json(response, 200, {
        service: HERO_SERVICE,
        portabilityGateContract: getPortabilityGateContractSummary()
      });
    }

    if (request.method === "GET" && url.pathname === "/team-contract") {
      return json(response, 200, {
        service: HERO_SERVICE,
        teamContract: getTeamContractSummary()
      });
    }

    if (request.method === "GET" && url.pathname === "/training-contract") {
      return json(response, 200, {
        service: HERO_SERVICE,
        trainingContract: getTrainingContractSummary()
      });
    }

    if (request.method === "GET" && url.pathname === "/team-research-contract") {
      return json(response, 200, {
        service: HERO_SERVICE,
        teamResearchContract: getTeamResearchContractSummary()
      });
    }

    if (request.method === "GET" && url.pathname === "/output-advisory-contract") {
      return json(response, 200, {
        service: HERO_SERVICE,
        outputAdvisoryContract: getOutputAdvisoryContractSummary()
      });
    }

      return json(response, 404, {
        service: HERO_SERVICE,
        status: "not_found"
      });
    } catch (error) {
      const rejectedReadResource = request.method === "GET" ? readModelAuditResource(url.pathname) : null;
      if (error instanceof OwnerAuthError && rejectedReadResource) {
        await recordReadAccess(rejectedReadResource, "rejected");
      }
      const known = error instanceof DashboardCommandError || error instanceof ProductDevelopmentError || error instanceof ProjectAccessError || error instanceof ProjectWorkspaceError || error instanceof ProjectSettingsError || error instanceof CollaborationError || error instanceof CommandCenterError || error instanceof SystemCatalogError || error instanceof PerformanceError || error instanceof NotificationError || error instanceof InfrastructureError || error instanceof DeliveryError || error instanceof HardeningError || error instanceof FinalReadinessError;
      const auth = error instanceof OwnerAuthError || error instanceof HumanIdentityError;
      return json(response, auth ? error.statusCode : known ? (error.statusCode ?? 409) : 500, {
        service: HERO_SERVICE,
        status: auth ? "authentication_required" : known ? "command_rejected" : "internal_error",
        code: auth || known ? error.code : "INTERNAL_ERROR",
        message: auth || known ? error.message : "خطای غیرمنتظره رخ داد."
      });
    }
  }

  return {
    server,
    async start() {
      if (!postgresRuntime && process.env.HERO_POSTGRES_URL?.trim()) {
        postgresRuntime = await createPostgresRuntime({ connectionString: process.env.HERO_POSTGRES_URL });
        ownsPostgresRuntime = true;
      }
      if (postgresRuntime) await postgresRuntime.ping();
      if (postgresRuntime?.projectIdentity) {
        const identityStore = postgresRuntime.projectIdentity;
        if (identityStore.listUsers) {
          const users = await identityStore.listUsers();
          for (const user of users) {
            projectAccessRegistry?.hydrateUser({ user: { userId: user.userId, email: user.email, displayName: user.displayName, role: "viewer", status: user.status, createdAt: user.createdAt } });
            humanIdentity?.hydrateUser({ user });
          }
        }
        if (identityStore.listCurrentGrants && projectAccessRegistry) {
          const grants = await identityStore.listCurrentGrants();
          for (const grant of grants) projectAccessRegistry.hydrateGrant({ grant });
        }
        if (identityStore.listSessionRevocations && humanIdentity?.restoreRevocations) {
          humanIdentity.restoreRevocations(await identityStore.listSessionRevocations());
        }
        if (humanIdentity?.persistenceRecord && identityStore.saveUser) {
          await identityStore.saveUser(humanIdentity.persistenceRecord({ userId: identityOwner.userId }));
        }
      }
      if (postgresRuntime?.projectWorkspace) {
        const workspaceStore = postgresRuntime.projectWorkspace;
        if (workspaceStore.listSettings && projectSettings.hydrateRecord) {
          for (const setting of await workspaceStore.listSettings()) {
            projectSettings.hydrateRecord({ ...setting, actorId: setting.actor });
            persistedWorkspaceRecords.add(workspaceRecordKey("setting", setting));
          }
        }
        if (workspaceStore.listProjects && projectWorkspace.hydrateProject) {
          for (const project of await workspaceStore.listProjects()) {
            projectWorkspace.hydrateProject({ project });
            persistedWorkspaceRecords.add(workspaceRecordKey("project", project));
          }
        }
        if (workspaceStore.listInputs && projectWorkspace.hydrateInput) {
          for (const input of await workspaceStore.listInputs()) {
            try { projectWorkspace.hydrateInput({ input }); persistedWorkspaceRecords.add(workspaceRecordKey("input", input)); } catch { /* a corrupt input row must not expose bytes or stop unrelated startup */ }
          }
        }
        if (workspaceStore.listFoundationProposals && projectWorkspace.hydrateFoundation) {
          for (const proposal of await workspaceStore.listFoundationProposals()) {
            projectWorkspace.hydrateFoundation({ proposal });
            persistedWorkspaceRecords.add(workspaceRecordKey("proposal", proposal));
          }
        }
        if (workspaceStore.listImportPlans && projectWorkspace.hydrateImport) {
          for (const plan of await workspaceStore.listImportPlans()) {
            projectWorkspace.hydrateImport({ plan });
            persistedWorkspaceRecords.add(workspaceRecordKey("import", plan));
          }
        }
      }
      if (postgresRuntime?.pricingCatalogStore && typeof pricingCatalog.publish === "function") {
        const currentPricingCatalog = await postgresRuntime.pricingCatalogStore.readCurrent();
        if (currentPricingCatalog) {
          pricingCatalog.publish(currentPricingCatalog);
          pricingCatalog.activate(currentPricingCatalog.catalogVersion);
        }
      }
      if (postgresRuntime?.benchmarkStore && typeof dashboard.attachAiBenchmarkStore === "function") {
        dashboard.attachAiBenchmarkStore(postgresRuntime.benchmarkStore);
        const benchmarkRuns = await postgresRuntime.benchmarkStore.list({ limit: 100 });
        dashboard.hydrateBenchmarks(benchmarkRuns);
      }
      if (postgresRuntime?.registrySnapshots && typeof dashboard.hydrateFromPersistence === "function") {
        const hydrated = await postgresRuntime.registrySnapshots.hydrate({
          registryIds: ["team-registry", "team-research", "principles-registry", "release-promotion", "planner", "project-memory", "ai-orchestration", "organization-performance", "skill-registry", "organization-advisor", "control-dashboard"]
        });
        const events = postgresRuntime.store ? await postgresRuntime.store.readAfter(0) : [];
        persistedDomainEventIds = new Set(events.map(event => event.eventId));
        dashboard.hydrateFromPersistence({ ...hydrated, events });
      }
      if (postgresRuntime?.ownerSessions && typeof ownerAuth.restoreRevocations === "function") {
        const revocations = await postgresRuntime.ownerSessions.list();
        ownerAuth.restoreRevocations(revocations);
        if (adminAuth.configured && typeof adminAuth.restoreRevocations === "function") adminAuth.restoreRevocations(revocations);
      }
      try {
        await new Promise((resolve, reject) => {
          server.once("error", reject);
          server.listen(port, host, resolve);
        });
      } catch (error) {
        if (ownsPostgresRuntime && postgresRuntime) {
          await postgresRuntime.close();
          postgresRuntime = null;
          ownsPostgresRuntime = false;
        }
        throw error;
      }
      const address = server.address();
      return typeof address === "object" && address ? address : { address: host, port };
    },
    async stop() {
      if (!server.listening) return;
      await new Promise((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
      });
      if (ownsPostgresRuntime && postgresRuntime) {
        await postgresRuntime.close();
        postgresRuntime = null;
        ownsPostgresRuntime = false;
      }
    }
  };
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : "";

if (currentFile === invokedFile) {
  const app = createHeroServer();
  const address = await app.start();
  console.log(JSON.stringify({
    level: "info",
    event: "hero.started",
    host: address.address,
    port: address.port,
    version: HERO_VERSION
  }));

  const shutdown = async signal => {
    console.log(JSON.stringify({ level: "info", event: "hero.stopping", signal }));
    await app.stop();
    process.exit(0);
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}
