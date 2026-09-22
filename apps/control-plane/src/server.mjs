import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
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
  getProductFactoryContractSummary,
  getProductRunnerContractSummary,
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
import { getProjectControlRoomHtml } from "./project-control-room-view.mjs";
import { getProjectWorkspaceHtml } from "./project-workspace-view.mjs";
import { getProjectWalkthroughHtml } from "./project-walkthrough-view.mjs";
import { createProjectWalkthroughAdvisory, createProjectWalkthroughProgress } from "./project-walkthrough.mjs";
import {
  HERO_SMART_TESTER_ERROR_REPORT_VERSION,
  HERO_SMART_TESTER_REPORT_TTL_MS,
  HERO_SMART_TESTER_VERSION,
  createSmartTesterAdvisory,
  createSmartTesterErrorReport,
  createSmartTesterReport,
  resolveSmartTesterContext
} from "./smart-tester.mjs";
import { createPrivateObjectStore } from "../../../packages/adapters/src/private-object-store.mjs";
import { createRepositoryReadContext, HERO_REPOSITORY_READ_CONTEXT_VERSION } from "./repository-read-context.mjs";
import { OwnerAuthError, createOwnerAuth } from "../../../packages/domain/src/owner-auth.mjs";
import { AdminAuthError, createAdminAuth } from "../../../packages/domain/src/admin-auth.mjs";
import { createHumanIdentity, HumanIdentityError, HUMAN_IDENTITY_SESSION_TTL_SECONDS } from "../../../packages/domain/src/human-identity.mjs";
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
import { createBackofficeCompletion, BackofficeCompletionError } from "../../../packages/domain/src/backoffice-completion.mjs";
import { AiOrchestrationError } from "../../../packages/domain/src/ai-orchestration.mjs";
import { evaluateAiAdvisorReadiness } from "../../../packages/domain/src/ai-advisor-readiness.mjs";
import { FormSuggestionsError, FORM_PROVIDER_SUGGESTIONS_SCHEMA, FORM_SUGGESTION_INITIAL_SUGGESTIONS, FORM_SUGGESTIONS_VERSION, createFormSuggestions, createProviderFormSuggestions, prepareFormSuggestionRefinement, prepareFormSuggestionRequest } from "../../../packages/domain/src/advisor.mjs";
import { ProjectIntakeAdvisorError, createProjectIntakeAdvisor } from "../../../packages/domain/src/project-intake-advisor.mjs";
import { rebuildPortfolioReadModel, rebuildProjectReadModel } from "../../../packages/domain/src/backoffice-read-models.mjs";
import { ProductDevelopmentError, createProductDevelopmentCatalog } from "../../../packages/domain/src/product-development.mjs";
import { HeroSecretStoreError, createConfiguredAiProviderAdapters, createHeroSecretStore, createNotionApiAdapter, createPostgresRuntime, createPricingCatalogRegistry, createRuntimeExternalSpendAuthorizer, readRuntimeExternalSpendPolicy } from "../../../packages/adapters/src/index.mjs";
import { advisorProfileOptions, createAiAssignmentProposal } from "./ai-assignment-planner.mjs";

const PRIVATE_ROBOTS_POLICY = "noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate";
const READ_MODEL_AUDIT_RESOURCES = new Set([
  "/backoffice",
  "/backoffice-data",
  "/backoffice-events",
  "/api/dashboard",
  "/api/ai/benchmarks",
  "/api/ai/benchmarks/compare",
  "/api/ai/credentials",
  "/api/ai/role-policies/history",
  "/api/teams/contract-history",
  "/api/audit",
  "/api/operations/diagnostics",
  "/product-studio",
  "/product-studio-data",
  "/product-studio-document",
  "/project-control",
  "/project-control-data"
  ,"/workspace",
  "/walkthrough"
]);
const BACKOFFICE_PATHS = new Set(["/backoffice", "/backoffice-data", "/backoffice-events"]);
const PRODUCT_STUDIO_PATHS = new Set(["/product-studio", "/product-studio-data", "/product-studio-document"]);
const PROJECT_CONTROL_PATHS = new Set(["/project-control", "/project-control-data"]);
const PROJECT_WORKSPACE_PATHS = new Set(["/workspace"]);
const PORTFOLIO_PATHS = new Set(["/portfolio", "/portfolio-data"]);
const WALKTHROUGH_PATHS = new Set(["/walkthrough"]);
const IDENTITY_PATHS = new Set(["/identity"]);
const BROWSER_PORTAL_PATH = "/api/portal";
const BROWSER_PORTAL_DATA_PATH = "/api/portal-data";
const BROWSER_PORTAL_DOCUMENT_PATH = "/api/portal-document";
const BROWSER_PORTAL_SURFACES = new Set(["identity", "portfolio", "command", "studio", "workspace", "control", "walkthrough", "ai"]);
const DEFAULT_BACKOFFICE_RESPONSE_LIMIT_BYTES = 512 * 1024;
const OPENAI_TEST_ADVISOR = Object.freeze({
  providerId: "openai",
  modelId: "gpt-5.6-luna",
  profileId: "openai-gpt-5.6-luna-analyst-v1",
  role: "analyst",
  catalogVersion: "openai-gpt-5.6-luna-20260916-v1",
  catalogSourceUrl: "https://developers.openai.com/api/docs/models/gpt-5.6-luna",
  catalogFetchedAt: "2026-09-16T00:00:00.000Z",
  catalogValidUntil: "2026-10-16T00:00:00.000Z",
  maxOutputTokens: 512,
  // The request includes a bounded, read-only repository context.  A 100-unit
  // ceiling was lower than the adapter's conservative preflight estimate for
  // that context, so valid requests were blocked before reaching the provider.
  // Keep this as a per-request cap well below the separately authorized
  // 50,000-unit Test ceiling while leaving room for the fixed context envelope.
  maxCostUnits: 10_000
});
const OPENAI_TEST_PRICING_CATALOG = Object.freeze({
  catalogVersion: OPENAI_TEST_ADVISOR.catalogVersion,
  sourceUrl: OPENAI_TEST_ADVISOR.catalogSourceUrl,
  fetchedAt: OPENAI_TEST_ADVISOR.catalogFetchedAt,
  validUntil: OPENAI_TEST_ADVISOR.catalogValidUntil,
  entries: Object.freeze([Object.freeze({
    providerId: OPENAI_TEST_ADVISOR.providerId,
    modelId: OPENAI_TEST_ADVISOR.modelId,
    pricingMode: "tokens",
    inputPricePer1mTokens: 0.2,
    cachedInputPricePer1mTokens: 0.02,
    outputPricePer1mTokens: 1.2,
    currency: "USD",
    sourceUrl: OPENAI_TEST_ADVISOR.catalogSourceUrl,
    fetchedAt: OPENAI_TEST_ADVISOR.catalogFetchedAt,
    validUntil: OPENAI_TEST_ADVISOR.catalogValidUntil
  })])
});
const LIVE_ADVISOR_ROLE = "analyst";
const LIVE_ADVISOR_OUTPUT_SCHEMA = "analysis-v1";
const LIVE_ADVISOR_SENSITIVE_ASSIGNMENT = /(?:\b(?:password|secret|credential|api[ _-]?key|token|mfa|توکن|رمز(?:\s*عبور)?|کلید\s*api)\b\s*[:=])\s*\S+/iu;
const LIVE_ADVISOR_SENSITIVE_VALUE = /(?:\bsk-[A-Za-z0-9_-]{12,}\b|\bBearer\s+[A-Za-z0-9._-]{12,}\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/iu;
const LIVE_ADVISOR_HOST_PATH = /(?:^|[\s"'(])(?:[A-Za-z]:[\\/]|\/(?:home|Users|mnt|opt)\/)/u;
const DEFAULT_BACKOFFICE_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_BACKOFFICE_RATE_LIMIT_MAX = 60;
const ADMIN_ALLOWED_MUTATIONS = new Set([
  "/api/ai/providers",
  "/api/ai/models",
  "/api/ai/profiles",
  "/api/ai/bindings",
  "/api/ai/project-scopes",
  "/api/ai/skills",
  "/api/ai/skill-bindings",
  "/api/ai/role-policies",
  "/api/form-suggestions",
  "/api/form-suggestions/refine",
  "/api/advisor",
  "/api/advisor/refine"
]);
// Human Identity is the browser-facing authority. Global AI catalog entries
// affect the whole private Hero installation, so they remain Owner-only.
// A project Admin may bind an already-approved Profile inside its Project Grant.
const HUMAN_OWNER_GLOBAL_AI_MUTATIONS = new Set([
  "/api/ai/providers",
  "/api/ai/models",
  "/api/ai/profiles",
  "/api/ai/skills",
  "/api/ai/skill-bindings",
  "/api/ai/role-policies"
]);
const PUBLIC_IDENTITY_PATHS = new Set([
  "/api/identity/status",
  "/api/identity/login",
  "/api/identity/login/mfa",
  "/api/identity/recovery/request",
  "/api/identity/recovery/complete"
]);
const PUBLIC_UI_ASSET_PATHS = new Set(["/api/ui-assets/vazirmatn.woff2"]);
const VAZIRMATN_FONT_PATH = fileURLToPath(new URL("./assets/fonts/Vazirmatn-wght.woff2", import.meta.url));
const VAZIRMATN_FONT = fs.readFileSync(VAZIRMATN_FONT_PATH);
const HUMAN_SESSION_COOKIE_NAME = "__Host-hero-human-session";
const EXPIRED_COOKIE_DATE = "Thu, 01 Jan 1970 00:00:00 GMT";
const AI_CREDENTIAL_PROVIDERS = Object.freeze(["openai", "anthropic", "google", "cursor", "openai-compatible"]);
const AI_CREDENTIAL_ENV = Object.freeze({
  openai: "HERO_OPENAI_API_KEY",
  anthropic: "HERO_ANTHROPIC_API_KEY",
  google: "HERO_GOOGLE_API_KEY",
  cursor: "HERO_CURSOR_API_KEY",
  "openai-compatible": "HERO_OPENAI_COMPATIBLE_API_KEY"
});

function parseCookie(header, name) {
  if (typeof header !== "string" || header.length === 0) return null;
  let result = null;
  for (const entry of header.split(";")) {
    const separator = entry.indexOf("=");
    if (separator < 1 || entry.slice(0, separator).trim() !== name) continue;
    // A duplicate authentication cookie is ambiguous. Do not choose one.
    if (result !== null) return null;
    try {
      result = decodeURIComponent(entry.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return result;
}

function humanSessionCookie(token) {
  return `${HUMAN_SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Max-Age=${HUMAN_IDENTITY_SESSION_TTL_SECONDS}; Path=/; Secure; HttpOnly; SameSite=Strict`;
}

function clearHumanSessionCookie() {
  return `${HUMAN_SESSION_COOKIE_NAME}=; Max-Age=0; Expires=${EXPIRED_COOKIE_DATE}; Path=/; Secure; HttpOnly; SameSite=Strict`;
}

function json(response, statusCode, body, { maxBytes, headers = {} } = {}) {
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
    "referrer-policy": "no-referrer",
    ...headers
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

function binary(response, statusCode, body, contentType, { cacheControl = "no-store" } = {}) {
  response.writeHead(statusCode, {
    "content-type": contentType,
    "content-length": body.byteLength,
    "cache-control": cacheControl,
    "x-robots-tag": PRIVATE_ROBOTS_POLICY,
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer"
  });
  response.end(body);
}

function redirect(response, location) {
  response.writeHead(302, {
    location,
    "cache-control": "no-store",
    "x-robots-tag": PRIVATE_ROBOTS_POLICY,
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer"
  });
  response.end();
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
  const releaseVersion = options.releaseVersion ?? process.env.HERO_RELEASE_VERSION ?? null;
  const sourceCommit = options.sourceCommit ?? process.env.HERO_SOURCE_COMMIT ?? null;
  const imageDigest = options.imageDigest ?? process.env.HERO_IMAGE_DIGEST ?? null;
  const backofficeAuth = basicAuthConfig(options);
  const requirePostgres = options.requirePostgres ?? process.env.HERO_REQUIRE_POSTGRES === "true";
  const backofficeResponseLimitBytes = options.backofficeResponseLimitBytes ?? DEFAULT_BACKOFFICE_RESPONSE_LIMIT_BYTES;
  if (!Number.isInteger(backofficeResponseLimitBytes) || backofficeResponseLimitBytes < 1_024 || backofficeResponseLimitBytes > 10 * 1024 * 1024) {
    throw new Error("Back Office response limit must be between 1024 and 10485760 bytes.");
  }
  const backofficeRateLimiter = createRateLimiter(options.backofficeRateLimit);
  const secretStore = options.secretStore ?? (options.enableTestSecretStore === true || process.env.HERO_SECRET_STORE_ENABLED === "true"
    ? createHeroSecretStore({
      root: options.secretStoreRoot ?? process.env.HERO_SECRET_STORE_DIR ?? path.join(process.env.HERO_DATA_DIR ?? "/var/lib/hero", "secret-store"),
      masterKey: options.secretStoreMasterKey ?? process.env.HERO_SECRET_STORE_MASTER_KEY,
      now: options.now ?? (() => new Date().toISOString()),
      environment: "test"
    })
    : null);
  if (secretStore?.enabled === true && secretStore.environment !== "test") {
    throw new HeroSecretStoreError("SECRET_STORE_ENVIRONMENT_UNSUPPORTED", "The embedded Secret Store is Test-only.", 500);
  }
  const pricingCatalog = options.pricingCatalogRegistry ?? createPricingCatalogRegistry({ now: options.clock ?? (() => Date.now()) });
  if (options.pricingCatalog) {
    pricingCatalog.publish(options.pricingCatalog);
    pricingCatalog.activate(options.pricingCatalog.catalogVersion ?? options.pricingCatalog.catalog_version);
  }
  // Test credentials need a versioned cost catalog even before a Provider is
  // registered. The embedded store itself is Test-only; check its declared
  // environment as well so an injected store can never make this Test
  // catalog available to another environment. The short-lived,
  // source-controlled entry prevents manual rates and fails closed when it
  // reaches its review date.
  const testSecretStoreEnabled = secretStore?.enabled === true && secretStore.environment === "test";
  if (testSecretStoreEnabled) {
    pricingCatalog.publish(OPENAI_TEST_PRICING_CATALOG);
    pricingCatalog.activate(OPENAI_TEST_PRICING_CATALOG.catalogVersion);
  }
  const requestedProviderAdapterOptions = options.providerAdapterOptions ?? {};
  const providerAdapterOptions = Object.fromEntries(AI_CREDENTIAL_PROVIDERS.map(providerId => [
    providerId,
    {
      ...(requestedProviderAdapterOptions[providerId] ?? {}),
      pricingCatalog: requestedProviderAdapterOptions[providerId]?.pricingCatalog ?? pricingCatalog,
      ...(secretStore ? {
        credentialResolver: credentialRef => {
          if (typeof credentialRef === "string" && credentialRef.startsWith("vault:")) return secretStore.get({ credentialRef });
          const envName = typeof credentialRef === "string" && credentialRef.startsWith("env:") ? credentialRef.slice(4) : AI_CREDENTIAL_ENV[providerId];
          return process.env[envName];
        }
      } : {})
    }
  ]));
  const providerAdapters = options.providerAdapters ?? ((options.enableRealProviders === true || process.env.HERO_ENABLE_REAL_PROVIDERS === "true" || secretStore?.enabled === true)
    ? createConfiguredAiProviderAdapters(providerAdapterOptions)
    : Object.freeze({}));
  const externalSpendAuthorizer = options.externalSpendAuthorizer ?? createRuntimeExternalSpendAuthorizer();
  // The picker/preflight path and the orchestration authorizer must evaluate
  // the same immutable Test authorization snapshot. Reading them separately
  // allowed a version/step/capability rotation to pass one gate and fail the
  // next one as ACTIVE_AUTHORIZATION_SNAPSHOT_REJECTED.
  const liveAdvisorPolicy = options.liveAdvisorPolicy
    ?? (typeof externalSpendAuthorizer?.policySnapshot === "function"
      ? externalSpendAuthorizer.policySnapshot
      : (() => readRuntimeExternalSpendPolicy()));
  const dashboard = options.dashboard ?? createControlDashboard({ now: options.now, providerAdapters, externalSpendAuthorizer });
  const repositoryRoot = options.repositoryRoot ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const repositoryReadContext = options.repositoryReadContext ?? createRepositoryReadContext({
    root: repositoryRoot,
    now: options.now ?? (() => new Date().toISOString())
  });
  const productDevelopment = options.productDevelopment ?? createProductDevelopmentCatalog({
    root: repositoryRoot,
    sourceCommit,
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
  const privateObjectStore = options.privateObjectStore ?? (process.env.HERO_PRIVATE_OBJECT_STORE_ENABLED === "true"
    ? createPrivateObjectStore({ root: process.env.HERO_OBJECT_STORE_DIR ?? path.join(process.env.HERO_DATA_DIR ?? "/var/lib/hero", "objects") })
    : null);
  const projectWorkspace = options.projectWorkspace ?? createProjectWorkspace({
    ownerUserId: identityOwner.userId,
    now: options.now,
    settings: projectSettings,
    scanner: options.uploadScanner,
    parser: options.projectInputParser,
    objectStoreAdapter: privateObjectStore
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
  const backofficeCompletion = options.backofficeCompletion ?? createBackofficeCompletion({ now: options.now });
  let postgresRuntime = options.postgresRuntime ?? null;
  let ownsPostgresRuntime = false;
  let persistedDomainEventIds = new Set();
  const persistedWorkspaceRecords = new Set();
  // Reports are intentionally transient and bound to the logged-in human.
  // Smart Tester is a development aid, not an audit or conversation store.
  const smartTesterReports = new Map();
  const smartTesterErrorReports = new Map();
  const smartTesterErrorDocuments = new Map();
  // Assignment proposals are short-lived, owner-scoped capabilities. They
  // contain only public catalog metadata and expected binding versions.
  const aiAssignmentProposals = new Map();
  const AI_ASSIGNMENT_PROPOSAL_TTL_MS = 30 * 60 * 1000;

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
    const request = project.version === 1 ? project.productRequest : null;
    if (request && postgresRuntime.projectWorkspace.appendProjectWithRequest) {
      await postgresRuntime.projectWorkspace.appendProjectWithRequest({ projectId: project.projectId, version: project.version, name: project.name, description: project.description, lifecycle: project.lifecycle, status: project.status, intake: project.intake, archivedLifecycle: project.archivedLifecycle ?? null, actorId: project.createdBy ?? identityOwner.userId, reason, requestId: request.requestId, requestVersion: request.version, idempotencyKey: request.idempotencyKey, requestFingerprint: request.fingerprint, requestMetadata: { projectId: request.projectId, source: "owner-project-intake" }, requestState: request.state });
    } else {
      await postgresRuntime.projectWorkspace.appendProject({ projectId: project.projectId, version: project.version, name: project.name, description: project.description, lifecycle: project.lifecycle, status: project.status, intake: project.intake, archivedLifecycle: project.archivedLifecycle ?? null, actorId: project.createdBy ?? identityOwner.userId, reason });
    }
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

  async function persistWorkspaceProjectAndProposal(project, proposal, reason = null) {
    if (!postgresRuntime?.projectWorkspace || !project) return;
    const projectKey = workspaceRecordKey("project", project);
    const proposalKey = proposal ? workspaceRecordKey("proposal", proposal) : null;
    const request = project.version === 1 ? project.productRequest : null;
    const store = postgresRuntime.projectWorkspace;
    if (!persistedWorkspaceRecords.has(projectKey) && !persistedWorkspaceRecords.has(proposalKey) && request && proposal && store.appendProjectWithRequestAndFoundation) {
      await store.appendProjectWithRequestAndFoundation({
        projectId: project.projectId,
        version: project.version,
        name: project.name,
        description: project.description,
        lifecycle: project.lifecycle,
        status: project.status,
        intake: project.intake,
        archivedLifecycle: project.archivedLifecycle ?? null,
        actorId: project.createdBy ?? identityOwner.userId,
        reason,
        requestId: request.requestId,
        requestVersion: request.version,
        idempotencyKey: request.idempotencyKey,
        requestFingerprint: request.fingerprint,
        requestMetadata: { projectId: request.projectId, source: "owner-project-intake" },
        requestState: request.state,
        proposalId: proposal.proposalId,
        proposalVersion: proposal.version,
        proposalState: proposal.state,
        proposal,
        proposalActorId: proposal.approvedBy ?? proposal.createdBy ?? identityOwner.userId
      });
      persistedWorkspaceRecords.add(projectKey);
      persistedWorkspaceRecords.add(proposalKey);
      return;
    }
    await persistWorkspaceProject(project, reason);
    await persistWorkspaceProposal(proposal);
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

  async function persistWorkspacePurge(purge) {
    if (!postgresRuntime?.projectWorkspace?.recordProjectPurge || !purge) return;
    await postgresRuntime.projectWorkspace.recordProjectPurge({
      projectId: purge.projectId,
      deletedBy: purge.deletedBy,
      reason: purge.reason,
      deletedObjectCount: purge.deletedObjectCount
    });
  }

  function backofficeSnapshot() {
    const snapshot = dashboard.backofficeSnapshot();
    const settings = snapshot.settings ?? {};
    const persistence = settings.persistence ?? {};
    const credentials = Object.freeze(AI_CREDENTIAL_PROVIDERS.map(providerId => {
      const credentialRef = `vault:hero/test/${providerId}/default`;
      let status;
      try {
        status = secretStore?.status({ credentialRef }) ?? Object.freeze({ credentialRef, providerId, environment: "test", configured: false, state: "secret-store-unavailable", version: null, updatedAt: null });
      } catch (error) {
        status = Object.freeze({ credentialRef, providerId, environment: "test", configured: false, state: "error", version: null, updatedAt: null, code: error?.code ?? "SECRET_STORE_ERROR" });
      }
      return Object.freeze({ providerId, environment: "test", credentialRef, state: status.state, configured: status.configured === true, version: status.version ?? null, updatedAt: status.updatedAt ?? null, secretValueExposed: false });
    }));
    return Object.freeze({
      ...snapshot,
      ai: Object.freeze({
        ...snapshot.ai,
        credentials,
        projectScopes: Object.freeze((snapshot.ai?.projectScopes ?? []).map(scope => Object.freeze({
          scopeId: scope.scopeId,
          projectId: scope.projectId,
          mode: scope.mode,
          capabilities: Object.freeze([...(scope.capabilities ?? [])]),
          version: scope.version,
          configuredAt: scope.configuredAt,
          configuredBy: scope.configuredBy?.id ?? scope.configuredBy?.subject ?? null,
          externalSpendBoundary: scope.externalSpendBoundary
        })))
      }),
      projects: Object.freeze(projectWorkspace.listProjects().map(project => Object.freeze({
        projectId: project.projectId,
        name: project.name,
        lifecycle: project.lifecycle
      }))),
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

  function assignmentProposalSnapshot(projectId, advisorProfileId = null) {
    const snapshot = backofficeSnapshot();
    const ai = snapshot.ai ?? {};
    const proposal = createAiAssignmentProposal({
      projectId,
      roles: ai.roles ?? ai.contract?.roles,
      providers: ai.providers,
      models: ai.models,
      profiles: ai.profiles,
      bindings: ai.bindings,
      defaultRolePolicies: ai.defaultRolePolicies
    });
    const advisors = advisorProfileOptions({ profiles: ai.profiles, providers: ai.providers, models: ai.models });
    const selectedAdvisor = advisorProfileId && advisors.find(item => item.profileId === advisorProfileId);
    const advisor = advisorProfileId && !selectedAdvisor
      ? Object.freeze({ source: "local", requestedProfileId: advisorProfileId, status: "not-eligible", reason: "Profile انتخابی برای بازبینی این پیشنهاد آماده و سازگار نیست." })
      : Object.freeze({ source: selectedAdvisor ? "connected-profile" : "local", profile: selectedAdvisor ?? null, status: "metadata-only", reason: selectedAdvisor ? "بازبینی Provider انتخابی فقط با اقدام جداگانه و مجوز زنده انجام می‌شود؛ ساخت پیشنهاد فعلی محلی و بدون هزینه است." : "پیشنهاد بر اساس Policy و کاتالوگ موجود Hero ساخته شد؛ بدون فراخوانی خارجی و بدون هزینه." });
    const proposalId = `ai-assignment-proposal-${crypto.randomUUID()}`;
    const assignments = proposal.assignments.map(item => {
      if (item.status !== "ready") return item;
      const recommendedProfile = item.requiresProfileCreation
        ? Object.freeze({ ...item.recommendedProfile, profileId: `hero-${projectId}-${item.role}-profile-${crypto.randomUUID()}`, profileVersion: 1 })
        : item.recommendedProfile;
      return Object.freeze({ ...item, recommendedProfile, bindingId: `hero-${projectId}-${item.role}-binding-${crypto.randomUUID()}`, idempotencyKey: `ai-assignment-${proposalId}-${item.role}` });
    });
    const stored = Object.freeze({
      proposalId,
      ownerId: identityOwner.userId,
      projectId,
      expiresAt: Date.now() + AI_ASSIGNMENT_PROPOSAL_TTL_MS,
      proposal: Object.freeze({ ...proposal, proposalId, advisor, assignments: Object.freeze(assignments) }),
      applied: new Set()
    });
    aiAssignmentProposals.set(proposalId, stored);
    setTimeout(() => aiAssignmentProposals.delete(proposalId), AI_ASSIGNMENT_PROPOSAL_TTL_MS).unref?.();
    return stored.proposal;
  }

  function readAssignmentProposal(proposalId, ownerId) {
    const stored = aiAssignmentProposals.get(proposalId);
    if (!stored || stored.expiresAt <= Date.now() || stored.ownerId !== ownerId) {
      aiAssignmentProposals.delete(proposalId);
      throw new DashboardCommandError("AI_ASSIGNMENT_PROPOSAL_NOT_FOUND", "پیشنهاد تخصیص پیدا نشد یا منقضی شده است؛ دوباره پیشنهاد بسازید.", 404);
    }
    return stored;
  }

  async function applyAssignmentProposal({ proposalId, projectId, actor }) {
    const stored = readAssignmentProposal(proposalId, identityOwner.userId);
    if (stored.projectId !== projectId) throw new DashboardCommandError("AI_ASSIGNMENT_PROJECT_MISMATCH", "پیشنهاد برای این پروژه ساخته نشده است.", 409);
    const current = dashboard.aiOrchestrationSnapshot();
    const direct = role => (current.bindings ?? []).find(binding => binding.projectId === projectId && binding.role === role && !binding.teamId && !binding.skillId) ?? null;
    const providers = new Map((current.providers ?? []).map(provider => [provider.providerId, provider]));
    const pending = stored.proposal.assignments.filter(item => item.status === "ready" && !stored.applied.has(item.role));
    const conflicts = pending.filter(item => {
      const actual = direct(item.role);
      return (item.existingBindingId ?? null) !== (actual?.bindingId ?? null);
    });
    if (conflicts.length) {
      throw new DashboardCommandError("AI_ASSIGNMENT_PROPOSAL_STALE", `دادهٔ تخصیص ${conflicts.map(item => item.roleLabel).join("، ")} بعد از ساخت پیشنهاد تغییر کرده است؛ پیشنهاد جدید بسازید.`, 409);
    }
    const results = [];
    for (const item of pending) {
      let profileCreated = false;
      try {
        if (item.requiresProfileCreation === true) {
          const provider = providers.get(item.recommendedProfile.providerId);
          const profileId = item.recommendedProfile.profileId;
          const existingProfile = (dashboard.aiOrchestrationSnapshot().profiles ?? []).find(profile => profile.profileId === profileId);
          if (existingProfile) {
            if (existingProfile.role !== item.role || existingProfile.providerId !== item.recommendedProfile.providerId || existingProfile.modelId !== item.recommendedProfile.modelId || existingProfile.status !== "active") {
              results.push({ role: item.role, roleLabel: item.roleLabel, status: "failed", code: "AI_ASSIGNMENT_PROFILE_CONFLICT" });
              break;
            }
          } else {
            if (!provider) {
              results.push({ role: item.role, roleLabel: item.roleLabel, status: "failed", code: "AI_ASSIGNMENT_PROVIDER_CHANGED" });
              break;
            }
            const credentialRef = provider.mode === "live"
              ? `vault:hero/test/${provider.providerId}/default`
              : `runtime:hero-assignment-${provider.providerId}`;
            try {
              await executeDashboardCommand("ai.assignment-plan-profile-create", {
                projectId,
                role: item.role,
                profileId,
                providerId: item.recommendedProfile.providerId,
                modelId: item.recommendedProfile.modelId,
                idempotencyKey: `${item.idempotencyKey}-profile`,
                actor
              }, () => dashboard.registerAiProfile({
                actor,
                profileId,
                role: item.role,
                providerId: item.recommendedProfile.providerId,
                modelId: item.recommendedProfile.modelId,
                credentialRef,
                promptVersion: `hero-auto-${item.role}-v1`,
                contextPolicy: "project-approved-context",
                toolPolicy: item.recommendedProfile.toolPolicy,
                outputSchema: item.recommendedProfile.outputSchema,
                status: "active",
                timeoutMs: 120_000,
                maxRetries: 0,
                maxOutputTokens: 1_024,
                maxCostUnits: 10_000,
                costLatencyPriority: "balanced",
                idempotencyKey: `${item.idempotencyKey}-profile`
              }), actor);
              profileCreated = true;
            } catch (profileError) {
              const afterProfileFailure = (dashboard.aiOrchestrationSnapshot().profiles ?? []).find(profile => profile.profileId === profileId);
              if (!afterProfileFailure || afterProfileFailure.role !== item.role || afterProfileFailure.providerId !== item.recommendedProfile.providerId || afterProfileFailure.modelId !== item.recommendedProfile.modelId || afterProfileFailure.status !== "active") {
                results.push({ role: item.role, roleLabel: item.roleLabel, status: "failed", code: profileError?.code ?? "AI_ASSIGNMENT_PROFILE_FAILED" });
                break;
              }
              profileCreated = true;
            }
          }
        }
        const result = await executeDashboardCommand("ai.assignment-plan-apply", {
          projectId,
          role: item.role,
          profileId: item.recommendedProfile.profileId,
          bindingId: item.bindingId,
          idempotencyKey: item.idempotencyKey,
          actor
        }, () => dashboard.bindAiRole({
          actor,
          bindingId: item.bindingId,
          projectId,
          role: item.role,
          profileId: item.recommendedProfile.profileId,
          supersedesBindingId: item.existingBindingId ?? null,
          idempotencyKey: item.idempotencyKey
        }), actor);
        stored.applied.add(item.role);
        results.push({ role: item.role, roleLabel: item.roleLabel, status: "applied", bindingId: result.binding?.bindingId ?? item.bindingId, profileId: item.recommendedProfile.profileId, profileCreated });
      } catch (error) {
        // The domain write happens before optional persistence/audit work in
        // executeDashboardCommand. If that follow-up fails, recognize the
        // already-applied immutable binding so a retry cannot duplicate it.
        const afterFailure = dashboard.aiOrchestrationSnapshot().bindings?.find(binding => binding.bindingId === item.bindingId);
        if (afterFailure?.projectId === projectId && afterFailure.role === item.role && afterFailure.profileId === item.recommendedProfile.profileId) {
          stored.applied.add(item.role);
          results.push({ role: item.role, roleLabel: item.roleLabel, status: "applied-with-audit-warning", bindingId: item.bindingId, profileId: item.recommendedProfile.profileId, profileCreated, code: error?.code ?? "AUDIT_PERSISTENCE_FAILED" });
        } else {
          results.push({ role: item.role, roleLabel: item.roleLabel, status: "failed", code: error?.code ?? "AI_ASSIGNMENT_FAILED" });
        }
        break;
      }
    }
    const remaining = stored.proposal.assignments.filter(item => item.status === "ready" && !stored.applied.has(item.role)).length;
    const appliedCount = results.filter(item => item.status === "applied" || item.status === "applied-with-audit-warning").length;
    const auditWarnings = results.filter(item => item.status === "applied-with-audit-warning").length;
    return Object.freeze({
      proposalId,
      projectId,
      status: remaining === 0 ? (auditWarnings ? "completed-with-audit-warning" : "completed") : "partial",
      counts: Object.freeze({ applied: appliedCount, failed: results.filter(item => item.status === "failed").length, auditWarnings, remaining }),
      results: Object.freeze(results),
      blockedRoles: Object.freeze(stored.proposal.assignments.filter(item => item.status === "needs-admin-setup").map(item => ({ role: item.role, roleLabel: item.roleLabel, reason: item.reason }))),
      safety: Object.freeze({ providerCalls: 0, providerModelEntriesCreated: 0, profileEntriesCreated: results.filter(item => item.profileCreated === true).length, existingBindingsPreserved: true })
    });
  }

  async function reviewAssignmentProposal({ proposalId, projectId }) {
    const stored = readAssignmentProposal(proposalId, identityOwner.userId);
    if (stored.projectId !== projectId) throw new DashboardCommandError("AI_ASSIGNMENT_PROJECT_MISMATCH", "پیشنهاد برای این پروژه ساخته نشده است.", 409);
    const selectedProfile = stored.proposal.advisor?.profile;
    if (!selectedProfile) {
      return Object.freeze({ proposalId, projectId, status: "local-only", providerInvoked: false, message: "پیشنهاد محلی بر اساس Policy و کاتالوگ موجود ساخته شده است؛ AI متصل برای بازبینی انتخاب نشده است." });
    }
    if (selectedProfile.connectionState === "local-ready") {
      return Object.freeze({ proposalId, projectId, status: "local-provider", providerInvoked: false, provider: selectedProfile.providerId, model: selectedProfile.modelId, profileId: selectedProfile.profileId, message: "Provider انتخابی محلی است؛ پیشنهاد بدون هزینه تولید شده و فراخوانی خارجی انجام نشد." });
    }
    const localSummary = stored.proposal.assignments.map(item => ({ role: item.role, status: item.status, recommendedProfileId: item.recommendedProfile?.profileId ?? null, reason: item.reason }));
    const live = await invokeSelectedLiveAdvisor({
      purpose: "ai-assignment-planner",
      projectId,
      selectedProfile,
      question: "این طرح تخصیص را فقط از نظر سازگاری نقش، Policy و ریسک بررسی کن؛ تصمیم نهایی با ادمین است.",
      context: { featureKey: "ai.assignment-proposal" },
      localResponse: JSON.stringify(localSummary)
    });
    if (!live) return Object.freeze({ proposalId, projectId, status: "not-invoked", providerInvoked: false, provider: selectedProfile.providerId, model: selectedProfile.modelId, profileId: selectedProfile.profileId, message: "فراخوانی این Provider در این حالت مجاز نیست؛ پیشنهاد محلی همچنان معتبر و قابل بررسی است." });
    return Object.freeze({ proposalId, projectId, status: "reviewed", providerInvoked: true, provider: selectedProfile.providerId, model: selectedProfile.modelId, profileId: selectedProfile.profileId, result: live.result, evidence: live.evidence });
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
    if (!projectId) return Object.freeze(snapshot);
    const overview = projectOverview(projectId);
    const foundationRoadmap = overview.foundationProposal?.suggested?.roadmap ?? [];
    const inputDocuments = overview.inputs.map((input, index) => Object.freeze({
      id: input.uploadId,
      title: input.filename ?? input.uploadId,
      path: "private-project-input (metadata only)",
      type: input.type,
      version: 1,
      owner: overview.project.createdBy ?? "project-owner",
      checksum: input.checksum ?? "not-recorded",
      editClass: "project-input-metadata",
      contentAvailable: false,
      order: index + 1
    }));
    const roadmap = foundationRoadmap.map((item, index) => Object.freeze({
      order: index + 1,
      title: String(item.title ?? item.id ?? `گام ${index + 1}`),
      status: item.status === "approved" ? "planned" : String(item.status ?? "planned"),
      statusLabel: item.status === "approved" ? "برنامه‌ریزی‌شده" : "پیشنهاد Foundation",
      owner: "مالک / ادمین پروژه",
      nextAction: overview.foundationProposal?.state === "approved" ? "شروع گام پس از تأییدهای لازم" : "بازبینی و تأیید Foundation"
    }));
    const graphNodes = roadmap.map(item => Object.freeze({ id: `${projectId}:${item.order}`, title: item.title, type: "project-roadmap-step", status: item.status }));
    return Object.freeze({
      scope: Object.freeze({ kind: "project", projectId, name: overview.project.name, isolation: "project-scoped" }),
      summary: Object.freeze({ productCount: 1, documentCount: inputDocuments.length, activeDocumentCount: inputDocuments.length, roadmapCount: roadmap.length, completeness: 0 }),
      products: Object.freeze([Object.freeze({ product_id: projectId, name: overview.project.name, status: overview.project.lifecycle, owner: overview.project.createdBy ?? "project-owner", completeness: Object.freeze({ score: 0 }), productDocuments: inputDocuments.map(document => Object.freeze({ id: document.id })), inheritedDocuments: Object.freeze([]) })]),
      documents: Object.freeze(inputDocuments),
      roadmap: Object.freeze(roadmap),
      roadmapGraph: Object.freeze({ nodes: Object.freeze(graphNodes), edges: Object.freeze([]), summary: Object.freeze({ nodeCount: graphNodes.length, edgeCount: 0, blockedCount: roadmap.filter(item => item.status === "blocked").length, doneCount: roadmap.filter(item => item.status === "done").length, orphanCount: 0, dependencyCycleCount: 0 }), diagnostics: Object.freeze({ dependencyCycleCount: 0 }) }),
      errors: Object.freeze(overview.inputs.filter(input => input.reviewRequired).map(input => Object.freeze({ code: "PROJECT_INPUT_REVIEW_REQUIRED", documentId: input.uploadId, detail: input.filename ?? "project input" }))),
      notion: snapshot.notion,
      projectOverview: overview
    });
  }

  function projectOverview(projectId) {
    const project = projectWorkspace.getProject(projectId);
    const inputs = projectWorkspace.listInputs({ projectId });
    const foundation = projectWorkspace.foundationProposal({ projectId });
    const settings = projectSettings.effectiveProject({ projectId }).map(item => ({ path: item.path, value: item.value, source: item.provenance, layer: item.layer, version: item.version }));
    const settingHistory = projectSettings.listRecords({ projectId }).map(item => ({ path: item.path, value: item.value, layer: item.layer, runId: item.runId ?? null, version: item.version, reason: item.reason, impact: item.impact, recordedAt: item.recordedAt }));
    const model = rebuildProjectReadModel({ project: {
      ...project,
      health: "unknown",
      tokenUsage: null,
      latestCompletedTask: null,
      nextTasks: foundation?.suggested?.roadmap ?? [],
      latestOutput: null
    } });
    const safeInputs = inputs.map(input => ({ uploadId: input.uploadId, type: input.type, filename: input.filename ?? input.label ?? null, label: input.type === "link" ? input.label ?? null : null, url: input.type === "link" ? input.url : null, fetchState: input.fetchState ?? null, byteLength: input.byteLength ?? null, checksum: input.checksum ?? null, scan: input.scan?.state ?? null, parse: input.parse?.state ?? null, reviewRequired: input.parse?.reviewRequired === true, createdAt: input.createdAt ?? null }));
    return Object.freeze({ ...model, intake: project.intake, foundationProposal: foundation, inputCount: inputs.length, inputs: safeInputs, imports: projectWorkspace.listImportPlans({ projectId }), settings, settingHistory });
  }

  function smartTesterProjectSummary(context) {
    if (!context.projectId) return null;
    try {
      const overview = projectOverview(context.projectId);
      const memory = projectCollaboration.retrieveMemory({ actor: { subject: identityOwner.userId, role: "project-owner" }, projectId: context.projectId });
      return Object.freeze({
        projectId: overview.project.projectId,
        lifecycle: overview.project.lifecycle,
        intakeComplete: Boolean(overview.intake?.goal && overview.intake?.users && overview.intake?.autonomy),
        foundationState: overview.foundationProposal?.state ?? "not-recorded",
        inputCount: overview.inputCount,
        settingPaths: Object.freeze((overview.settings ?? []).map(setting => setting.path).slice(0, 20)),
        memoryEntryCount: memory.length,
        available: true
      });
    } catch (error) {
      // A stale URL must still let the Owner open the panel and receive an
      // explicit report. The run will show backend attention; it must not turn
      // a read-only diagnostic click into a hard 404 screen.
      return Object.freeze({ projectId: context.projectId, lifecycle: "unavailable", intakeComplete: false, foundationState: "unavailable", inputCount: 0, settingPaths: Object.freeze([]), memoryEntryCount: 0, available: false, reason: error?.code ?? "PROJECT_CONTEXT_UNAVAILABLE" });
    }
  }

  /**
   * Delivers only the safe, project-scoped metadata needed by the Walk-Through
   * advisor picker.  Credentials, prompts, user questions and raw model output
   * are deliberately absent.  A registered Provider is not presented as
   * connected until its recorded mode and health evidence support that claim.
   */
  function walkthroughAdvisorOptions(projectId, { includeUnbound = false, purpose = "walkthrough-guide" } = {}) {
    const ai = dashboard.aiOrchestrationSnapshot();
    const projectScope = (ai.projectScopes ?? []).find(scope => scope.projectId === projectId) ?? null;
    const latestHealth = new Map();
    for (const event of dashboard.aiOrchestrationEvents(0)) {
      if (event.type !== "ai.provider-health-checked" || !event.data?.providerId) continue;
      latestHealth.set(event.data.providerId, {
        status: event.data.status,
        code: event.data.code,
        checkedAt: event.occurredAt,
        latencyMs: event.data.latencyMs ?? null
      });
    }
    const usageByProvider = new Map((ai.usageByProvider ?? []).map(item => [item.providerId, item]));
    const providers = (ai.providers ?? []).map(provider => {
      const health = latestHealth.get(provider.providerId) ?? null;
      const connectionState = provider.mode === "disabled"
        ? "disabled"
        : provider.mode === "deterministic"
          ? "local-ready"
          : health?.status === "healthy"
            ? "healthy"
            : health?.status === "blocked"
              ? "blocked"
              : "not-verified";
      return Object.freeze({
        providerId: provider.providerId,
        displayName: provider.displayName,
        mode: provider.mode,
        capabilities: Object.freeze([...(provider.capabilities ?? [])]),
        advisorCompatible: provider.providerId !== "cursor" || (provider.capabilities ?? []).includes("interactive-advisor"),
        connection: Object.freeze({ state: connectionState, latestHealth: health }),
        usage: Object.freeze(usageByProvider.get(provider.providerId) ?? {
          providerId: provider.providerId,
          invocationCount: 0,
          completedCount: 0,
          failedCount: 0,
          blockedCount: 0,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          costUnits: 0
        })
      });
    });
    const providerById = new Map(providers.map(provider => [provider.providerId, provider]));
    const modelByKey = new Map((ai.models ?? []).map(model => [`${model.providerId}:${model.modelId}`, model]));
    const bindingsByProfile = new Map();
    for (const binding of ai.bindings ?? []) {
      if (binding.projectId !== projectId || binding.teamId || binding.skillId) continue;
      if (!bindingsByProfile.has(binding.profileId)) bindingsByProfile.set(binding.profileId, binding);
    }
    const profiles = (ai.profiles ?? [])
      // Walk-Through and Smart Tester are advisor surfaces, not a general
      // role picker.  Other role Profiles may legitimately share the same
      // Provider/Model, but they have different schemas and permissions and
      // must never appear as disabled advisor choices.
      .filter(profile => profile.status === "active"
        && profile.role === LIVE_ADVISOR_ROLE
        && profile.outputSchema === LIVE_ADVISOR_OUTPUT_SCHEMA
        && profile.toolPolicy === "read-only")
      .map(profile => {
        const provider = providerById.get(profile.providerId);
        const model = modelByKey.get(`${profile.providerId}:${profile.modelId}`);
        const binding = bindingsByProfile.get(profile.profileId) ?? null;
        let liveAuthorization = provider?.mode === "deterministic"
          ? { authorized: true, code: "LOCAL_PROVIDER", expiresAtMs: Number.POSITIVE_INFINITY }
          : null;
        if (provider?.mode === "live") {
          try {
            liveAuthorization = { ...activeLiveAdvisorAuthorization({
              purpose,
              projectId,
              providerId: profile.providerId,
              modelId: profile.modelId,
              role: profile.role
            }), expiresAtMs: Number.POSITIVE_INFINITY };
          } catch (error) {
            liveAuthorization = { authorized: false, code: error?.code ?? "LIVE_ADVISOR_AUTHORIZATION_UNAVAILABLE", expiresAtMs: 0 };
          }
        }
        // Advisor services use one global Profile contract.  Per-project
        // bindings are provisioned just-in-time only after all live gates
        // pass, so they never become an admin setup task or an authorization
        // shortcut.  A project still keeps its own context and audit trail.
        const readinessBinding = binding ?? Object.freeze({
          bindingId: `advisor-service-${profile.profileId}`,
          projectId,
          role: profile.role,
          profileId: profile.profileId,
          source: "backoffice-advisor-service"
        });
        const readiness = evaluateAiAdvisorReadiness({
          purpose,
          projectId,
          provider: provider ? { ...provider, advisorCompatible: provider.advisorCompatible } : null,
          model,
          profile,
          binding: readinessBinding,
          // Advisor availability is a Back Office service policy rather than
          // a project configuration. Explicit project scopes remain available
          // to other AI orchestration flows, but do not gate these three
          // human-facing read-only advisor surfaces.
          projectScope: null,
          health: provider?.mode === "deterministic" ? { status: "healthy", code: "LOCAL_PROVIDER_READY" } : provider?.connection?.latestHealth,
          authorization: liveAuthorization
        });
        // The connected AI/profile is Back Office configuration, not a
        // per-project setting. Show a healthy compatible profile in every
        // project picker. Dispatch remains fail-closed behind the explicit
        // Test authorization snapshot; an internal binding is provisioned
        // only after that authorization passes.
        // `selectable` means a service can be selected as the global UI
        // preference; `dispatchReady` means this particular project may send
        // a live request right now.
        const serviceReady = readiness.checks
          .filter(check => ["provider", "model", "profile", "health"].includes(check.id))
          .every(check => check.passed === true);
        const dispatchReady = readiness.selectable;
        return Object.freeze({
          profileId: profile.profileId,
          role: profile.role,
          providerId: profile.providerId,
          providerName: provider?.displayName ?? profile.providerId,
          modelId: profile.modelId,
          modelName: model?.displayName ?? profile.modelId,
          profileVersion: profile.profileVersion,
          outputSchema: profile.outputSchema,
          connectionState: provider?.connection?.state ?? "not-registered",
          selectable: serviceReady,
          dispatchReady,
          ...(dispatchReady ? {} : { readiness }),
          selectionNotice: dispatchReady
            ? provider.mode === "deterministic"
              ? "پاسخ deterministic و بدون هزینهٔ Provider خارجی است."
              : "برای فراخوانی زنده آماده است؛ سقف مصرف و مجوز نسخه‌دار همچنان اعمال می‌شود."
            : serviceReady
              ? "این AI به‌صورت سراسری در Back Office قابل انتخاب است؛ اجرای زنده پس از فعال‌شدن مجوز صریح سرویس سراسری Test در دسترس می‌شود."
            : `${readiness.selectionNotice} (${readiness.code})${readiness.nextAction ? ` اقدام بعدی: ${readiness.nextAction}` : ""}`
        });
      });
    // Multiple advisor Profiles may still point at one Provider/Model (for
    // example after a versioned replacement). Keep the catalog intact, but
    // expose one deterministic choice per Provider/Model in advisor UIs.
    const seenAdvisorModels = new Set();
    // Prefer the profile that is dispatch-ready for the current project when
    // a versioned replacement shares Provider/Model with an older profile.
    // This avoids showing a globally selectable-but-not-yet-bound duplicate
    // in place of the ready one.
    const uniqueProfiles = [...profiles].sort((left, right) => (
      Number(right.dispatchReady === true) - Number(left.dispatchReady === true)
      || String(left.profileId).localeCompare(String(right.profileId))
    )).filter(profile => {
      const key = `${profile.providerId}:${profile.modelId}`;
      if (seenAdvisorModels.has(key)) return false;
      seenAdvisorModels.add(key);
      return true;
    });
    return Object.freeze({
      projectId,
      selectionScope: "backoffice-service",
      projectScope: projectScope ?? Object.freeze({ projectId, mode: "implicit", capabilities: [purpose], version: 0, externalSpendBoundary: "separate-authorization-required" }),
      localAdvisor: Object.freeze({ id: "local", label: "راهنمای محلی Hero", mode: "local-contextual-guidance", selectable: true, notice: "بدون اتصال خارجی، بدون هزینه و بدون ذخیرهٔ متن گفتگو." }),
      providers: Object.freeze(providers),
      models: Object.freeze((ai.models ?? []).map(model => Object.freeze({ providerId: model.providerId, modelId: model.modelId, displayName: model.displayName }))),
      profiles: Object.freeze(uniqueProfiles)
    });
  }

  function smartTesterAdvisorOptions(projectId = null) {
    // A project-scoped Smart Tester request may invoke a live Provider. Keep
    // it bound to the same project boundary as Walk-Through; the global panel
    // may still show unbound profiles as local-only selections.
    const options = walkthroughAdvisorOptions(projectId, { includeUnbound: projectId === null, purpose: "smart-tester" });
    return Object.freeze({
      ...options,
      projectId: projectId ?? null,
      defaultAdvisorId: "local",
      note: "AIهای آماده یک‌بار برای سرویس Back Office انتخاب می‌شوند و در همهٔ پروژه‌ها نمایش داده می‌شوند؛ اجرای زنده تنها با Health و مجوز صریح سرویس سراسری Test انجام می‌شود.",
      models: Object.freeze(options.models.map(model => Object.freeze({
        ...model,
        selectable: options.profiles.some(profile => profile.providerId === model.providerId && profile.modelId === model.modelId && profile.selectable === true),
        selectionNotice: options.profiles.find(profile => profile.providerId === model.providerId && profile.modelId === model.modelId)?.selectionNotice ?? "Profile سازگار و آماده‌ای برای این Model وجود ندارد؛ از «پیشنهاد اتصال همهٔ نقش‌ها» برای ساخت امن آن استفاده کنید.",
        setupAction: "ai-assignment-proposal"
      })))
    });
  }

  function formSuggestionOptions(projectId = null) {
    const options = walkthroughAdvisorOptions(projectId, { includeUnbound: projectId === null, purpose: "form-suggestions" });
    return Object.freeze({
      version: FORM_SUGGESTIONS_VERSION,
      projectId,
      localAdvisor: options.localAdvisor,
      providers: options.providers,
      models: Object.freeze(options.models.map(model => Object.freeze({
        ...model,
        selectable: options.profiles.some(profile => profile.providerId === model.providerId && profile.modelId === model.modelId && profile.selectable === true),
        selectionNotice: options.profiles.find(profile => profile.providerId === model.providerId && profile.modelId === model.modelId)?.selectionNotice ?? "Profile سازگار و آماده‌ای برای این Model وجود ندارد؛ از «پیشنهاد اتصال همهٔ نقش‌ها» برای ساخت امن آن استفاده کنید.",
        setupAction: "ai-assignment-proposal"
      }))),
      profiles: options.profiles,
      note: "Advisor محلی همیشه در دسترس است. AIهای سازگار یک‌بار برای سرویس Back Office انتخاب می‌شوند و در همهٔ پروژه‌ها نمایش داده می‌شوند؛ اجرای زنده با مجوز صریح سرویس سراسری Test و سقف مصرف همان مجوز انجام می‌شود."
    });
  }

  function activeLiveAdvisorAuthorization({ purpose, projectId, providerId, modelId, role }) {
    let policy;
    try { policy = typeof liveAdvisorPolicy === "function" ? liveAdvisorPolicy() : liveAdvisorPolicy; } catch (error) {
      throw new ProjectWorkspaceError("LIVE_ADVISOR_AUTHORIZATION_UNAVAILABLE", `مجوز هزینهٔ AI قابل‌خواندن نیست: ${error?.code ?? "CONFIGURATION_INVALID"}.`, 503);
    }
    if (!policy?.active || policy.globalStop === true) {
      throw new ProjectWorkspaceError("LIVE_ADVISOR_AUTHORIZATION_UNAVAILABLE", "مجوز هزینهٔ AI فعال نیست یا توقف اضطراری برقرار است.", 503);
    }
    const projectMatches = policy.projectScope === "all-test-projects"
      ? /^[a-z][a-z0-9-]{2,62}$/.test(projectId)
      : policy.projectId === projectId;
    if (Date.now() >= policy.expiresAtMs || !projectMatches || policy.providerId !== providerId || !policy.modelIds?.includes(modelId) || !policy.roleIds?.includes(role) || !policy.capabilities?.includes(purpose)) {
      throw new ProjectWorkspaceError("LIVE_ADVISOR_AUTHORIZATION_SCOPE_MISMATCH", "مجوز هزینهٔ AI با Project، Provider، Model یا Role انتخاب‌شده هم‌خوان نیست.", 403);
    }
    return Object.freeze({
      authorized: true,
      action: "external-spend",
      code: "AUTHORIZED",
      authorizationId: policy.authorizationId,
      projectId,
      ...(policy.projectScope === "all-test-projects" ? { projectScope: "all-test-projects" } : {}),
      stepId: policy.stepId,
      documentVersion: policy.documentVersion,
      capability: purpose,
      providerId,
      modelId,
      role,
      // The authorization remains the cumulative ceiling.  Live advisors
      // additionally use the small, versioned per-request bound published
      // with this Test-only model catalog, leaving room for both approved
      // scenarios under one authorization.
      maxCostUnits: Math.min(policy.maxCostUnits, OPENAI_TEST_ADVISOR.maxCostUnits),
      globalStop: false
    });
  }

  function liveAdvisorResult(invocation) {
    const output = invocation?.response?.output;
    const candidate = [output?.answer, output?.response, output?.summary].find(value => typeof value === "string" && value.trim());
    if (output?.schema !== LIVE_ADVISOR_OUTPUT_SCHEMA || !candidate) {
      throw new ProjectWorkspaceError("LIVE_ADVISOR_OUTPUT_INVALID", "پاسخ ساخت‌یافتهٔ قابل‌نمایش از Provider دریافت نشد.", 502);
    }
    if (LIVE_ADVISOR_SENSITIVE_VALUE.test(candidate) || LIVE_ADVISOR_HOST_PATH.test(candidate)) {
      throw new ProjectWorkspaceError("LIVE_ADVISOR_OUTPUT_SENSITIVE", "پاسخ Provider شامل دادهٔ حساس یا مسیر میزبان بود و رد شد.", 502);
    }
    return Object.freeze({
      schema: LIVE_ADVISOR_OUTPUT_SCHEMA,
      answer: candidate.replace(LIVE_ADVISOR_SENSITIVE_ASSIGNMENT, "[redacted]").slice(0, 4_000)
    });
  }

  function liveAdvisorEvidence({ purpose, projectId, selectedProfile, binding, invocation, result }) {
    const usage = invocation?.response?.usage ?? {};
    const pricing = usage.pricing ?? {};
    return Object.freeze({
      schemaVersion: "hero.ai-advisor-evidence/v1",
      scenarioId: `${purpose}-${invocation.invocationId}`,
      capability: purpose,
      provider: selectedProfile.providerId,
      model: selectedProfile.modelId,
      role: selectedProfile.role,
      projectId,
      bindingId: binding?.bindingId ?? null,
      profileId: selectedProfile.profileId,
      profileVersion: selectedProfile.profileVersion,
      status: invocation.status,
      code: invocation.code,
      attempts: invocation.attempts ?? null,
      latencyMs: invocation.latencyMs ?? null,
      usage: Object.freeze({
        inputTokens: usage.inputTokens ?? null,
        outputTokens: usage.outputTokens ?? null,
        totalTokens: usage.totalTokens ?? null,
        cachedInputTokens: usage.cachedInputTokens ?? null,
        costUnits: usage.costUnits ?? null,
        accountedCostUnits: invocation.accountedCostUnits ?? null,
        pricingCatalog: pricing.catalogVersion ?? null,
        currency: pricing.currency ?? null,
        inputPricePer1mTokens: pricing.inputPricePer1mTokens ?? null,
        outputPricePer1mTokens: pricing.outputPricePer1mTokens ?? null,
        cachedInputPricePer1mTokens: pricing.cachedInputPricePer1mTokens ?? null
      }),
      resultSchema: result.schema,
      timestamp: invocation.completedAt ?? invocation.requestedAt ?? null
    });
  }

  function liveAdvisorFailureMessage(code, reason = null) {
    const messages = {
      CREDENTIAL_NOT_CONFIGURED: "کلید Provider در Secret Store محیط Test برای اجرای زنده در دسترس نیست.",
      PROVIDER_AUTHENTICATION_FAILED: "Provider کلید یا اعتبارنامهٔ محیط Test را نپذیرفت.",
      PROVIDER_PERMISSION_DENIED: "Provider اجازهٔ این درخواست را نداد؛ دسترسی حساب یا پروژه را بررسی کنید.",
      PROVIDER_MODEL_OR_ENDPOINT_NOT_FOUND: "مدل یا مسیر API در Provider پیدا نشد.",
      PROVIDER_REQUEST_REJECTED: "Provider ساختار درخواست یا تنظیم مدل را رد کرد.",
      PROVIDER_RATE_LIMITED: "Provider موقتاً محدودیت نرخ یا سهمیه اعمال کرده است.",
      PROVIDER_UPSTREAM_UNAVAILABLE: "Provider موقتاً در دسترس نیست؛ بعداً دوباره تلاش کنید.",
      PROVIDER_NETWORK_ERROR: "ارتباط شبکه با Provider برقرار نشد.",
      PROVIDER_TIMEOUT: "Provider در مهلت تعیین‌شده پاسخ نداد.",
      PROVIDER_OUTPUT_NOT_JSON: "Provider پاسخ ساخت‌یافتهٔ JSON برنگرداند.",
      PROVIDER_OUTPUT_EMPTY: "Provider پاسخ متنی قابل‌نمایش برنگرداند.",
      COST_POLICY_INSUFFICIENT: "سقف هزینهٔ هر درخواست برای Context فعلی کافی نیست.",
      PROVIDER_UNHEALTHY: "بررسی سلامت Provider ناموفق بود.",
      PROVIDER_CIRCUIT_OPEN: "Provider پس از خطاهای مکرر موقتاً متوقف شده است.",
      ACTIVE_AUTHORIZATION_SNAPSHOT_REJECTED: "مجوز نسخه‌دار هزینه با درخواست فعلی هم‌خوان نیست؛ تنظیمات نسخه، Step، Provider، Model، Role و قابلیت باید از یک snapshot واحد خوانده شوند."
    };
    const base = messages[code] ?? "فراخوانی Provider کامل نشد.";
    if (code !== "ACTIVE_AUTHORIZATION_SNAPSHOT_REJECTED" || typeof reason !== "string") return base;
    // The domain layer emits only a safe field-name list. Keep the UI useful
    // without ever copying credentials, prompts, or raw provider messages.
    const allowedFields = new Set([
      "authorizationId",
      "projectId",
      "stepId",
      "documentVersion",
      "providerId",
      "modelId",
      "role",
      "capability",
      "maxCostUnits",
      "stop-control"
    ]);
    const fields = [...new Set(reason.match(/[A-Za-z][A-Za-z0-9-]*/g) ?? [])].filter(field => allowedFields.has(field));
    return fields.length > 0 ? `${base} فیلد ناسازگار: ${fields.join("، ")}.` : base;
  }

  async function invokeSelectedLiveAdvisor({ purpose, projectId, selectedProfile, question, context, localResponse }) {
    const ai = dashboard.aiOrchestrationSnapshot();
    const provider = (ai.providers ?? []).find(item => item.providerId === selectedProfile.providerId);
    const configuredProfile = (ai.profiles ?? []).find(item => item.profileId === selectedProfile.profileId);
    if (provider?.mode !== "live") return null;
    if (selectedProfile.role !== LIVE_ADVISOR_ROLE || selectedProfile.outputSchema !== LIVE_ADVISOR_OUTPUT_SCHEMA || configuredProfile?.toolPolicy !== "read-only") {
      throw new ProjectWorkspaceError("LIVE_ADVISOR_POLICY_MISMATCH", "Live advisor فقط با Role، Output Schema و Tool Policy مجاز قابل اجراست.", 403);
    }
    const authorization = activeLiveAdvisorAuthorization({ purpose, projectId, providerId: selectedProfile.providerId, modelId: selectedProfile.modelId, role: selectedProfile.role });
    let binding = dashboard.aiOrchestration.resolveBinding({ projectId, role: selectedProfile.role });
    if (!binding) {
      // This is an internal, append-only service provisioning record. It is
      // created only after the exact Test authorization has passed, contains
      // no credential, and gives a new Project the globally configured
      // read-only analyst Profile without an admin visiting AI Connections.
      try {
        dashboard.bindAiRole({
          bindingId: `advisor-service-${projectId}-${crypto.randomUUID()}`,
          projectId,
          teamId: null,
          skillId: null,
          role: selectedProfile.role,
          profileId: selectedProfile.profileId,
          supersedesBindingId: null,
          idempotencyKey: `advisor-service-binding-${projectId}-${selectedProfile.profileId}`,
          actor: { kind: "admin", id: "hero-backoffice-advisor-service" }
        });
      } catch (error) {
        // A concurrent first request may have won the append-only binding
        // race. Re-read once; any incompatible existing binding still fails
        // closed below instead of being replaced automatically.
        binding = dashboard.aiOrchestration.resolveBinding({ projectId, role: selectedProfile.role });
        if (!binding) throw error;
      }
      binding = dashboard.aiOrchestration.resolveBinding({ projectId, role: selectedProfile.role });
    }
    if (!binding || binding.profileId !== selectedProfile.profileId) {
      throw new ProjectWorkspaceError("LIVE_ADVISOR_BINDING_MISMATCH", "Binding تحلیل‌گر این Project با سرویس سراسری انتخاب‌شده هم‌خوان نیست و به‌صورت خودکار جایگزین نمی‌شود.", 403);
    }
    const requestedFormSuggestionCount = Number(context?.formSuggestion?.requestedSuggestionCount);
    const formSuggestionCountInstruction = Number.isInteger(requestedFormSuggestionCount) && requestedFormSuggestionCount >= 1 && requestedFormSuggestionCount <= FORM_SUGGESTION_INITIAL_SUGGESTIONS
      ? `Return exactly ${requestedFormSuggestionCount} suggestion${requestedFormSuggestionCount === 1 ? "" : "s"}.`
      : "Return one to three suggestions.";
    const repositoryContext = ["smart-tester", "walkthrough-guide"].includes(purpose)
      ? repositoryReadContext.build({
        sourceFiles: [
          ...(Array.isArray(context?.sourceFiles) ? context.sourceFiles : []),
          ...(purpose === "smart-tester" ? [
            "apps/control-plane/src/smart-tester.mjs",
            "apps/control-plane/src/repository-read-context.mjs"
          ] : [
            "apps/control-plane/src/project-walkthrough.mjs",
            "apps/control-plane/src/project-walkthrough-view.mjs",
            "apps/control-plane/src/hero-shell.mjs"
          ])
        ],
        surface: context?.pathname ?? (purpose === "walkthrough-guide" ? "/walkthrough" : null),
        featureKey: context?.featureKey ?? (purpose === "walkthrough-guide" ? "guide.walkthrough" : null),
        question
      })
      : null;
    const dispatchInput = Object.freeze({
      invocationId: `advisor-${purpose}-${crypto.randomUUID()}`,
      projectId,
      role: selectedProfile.role,
      taskId: `advisor-${purpose}`,
      stepId: authorization.stepId,
      documentVersion: authorization.documentVersion,
      contextSnapshotId: `advisor-context-${crypto.randomUUID()}`,
      idempotencyKey: `advisor-request-${crypto.randomUUID()}`,
      request: Object.freeze({
        purpose,
        locale: "fa-IR",
        question: typeof question === "string" ? question : "",
        localGuidance: localResponse,
        constraints: Object.freeze([
          "Return only JSON.",
          "Set the outer schema exactly to analysis-v1.",
          ...(purpose === "form-suggestions" ? [
            "Set the answer field to a JSON string whose parsed object schema is form-suggestions-v1.",
            "Analyze the supplied form title, purpose hint, field labels, required flags and allowed options before suggesting values.",
            "Set boxPurpose to a clear Persian explanation of 2 to 4 sentences (80 to 700 characters) describing why this box exists, what decision or record it controls, and what does not happen automatically.",
            "Do not use raw identifiers, UUIDs, version strings or the overall software goal as the box purpose.",
            `${formSuggestionCountInstruction} Each suggestion.entries must include every supplied form field exactly once, in the supplied order, even when it is optional. Every entry must contain the supplied field name exactly, a string value, and the exact supplied type when available; select/radio values must be one of the supplied options. Never include submit buttons, actions or UI-only controls.`,
            ...(context?.formSuggestion?.refinement === true ? [
              "Include feedbackResponse: a concise Persian explanation of how the feedback was interpreted and what materially changed in this one new suggestion. It is a short user-facing rationale, not hidden chain-of-thought, and must not quote sensitive data or claim a write was performed.",
              "Make the new values materially different in detail, emphasis or structure whenever the feedback requests a change. Do not recycle a generic prior-template answer.",
              "When the transient request names individual fields, apply each numbered instruction only to its matching field. A field requested to be concise must be a single clear statement of at most 220 characters; a field requested to be detailed must contain at least 220 characters of concrete, form-relevant detail. Mention the affected field labels in feedbackResponse."
            ] : []),
            ...(context?.formSuggestion?.documentProposalEligible === true ? [
              "Only when an optional project-input document would help, you may include one documentProposal with title, filename ending in .txt or .md, compact Persian content, and rationale. It is a review-only draft: never claim it has been uploaded, stored or applied."
            ] : ["Do not include documentProposal for this form."])
          ] : []),
          "Use concise Persian.",
          "Do not include secrets, credentials, host paths, tools, or executable actions."
        ])
      }),
      context: Object.freeze({
        advisor: purpose,
        projectId,
        bindingId: binding.bindingId,
        surface: context?.pathname ?? null,
        featureKey: context?.featureKey ?? null,
        stepId: context?.stepId ?? null,
        ...(context?.formSuggestion ? { formSuggestion: context.formSuggestion } : {}),
        ...(repositoryContext ? { repositoryContext } : {})
      }),
      // Form Suggestions is an explicitly ephemeral browser dialog. The
      // provider output is needed for this response but must not enter the
      // invocation registry snapshot or become project history.
      transientResponse: purpose === "form-suggestions",
      requireHealthyProvider: true,
      externalSpendAuthorization: authorization
    });
    // Live advisor calls must use the same command boundary as every other
    // dashboard mutation. This persists invocation success/blocks and the
    // redacted domain event to PostgreSQL, while keeping provider output out
    // of audit data.
    const dispatch = () => executeDashboardCommand("ai.invoke", { projectId }, () => dashboard.invokeAi({
      ...dispatchInput,
      // A context bootstrap retry is a new idempotent command. Reusing the
      // first attempt's idempotency key would look like a conflicting memory
      // write after the fixed redacted anchor is created.
      invocationId: `advisor-${purpose}-${crypto.randomUUID()}`,
      contextSnapshotId: `advisor-context-${crypto.randomUUID()}`,
      idempotencyKey: `advisor-request-${crypto.randomUUID()}`
    }));
    let result;
    try {
      result = await dispatch();
    } catch (error) {
      const contextMissing = error?.code === "CONTEXT_ASSEMBLY_BLOCKED" && /\bCONTEXT_NOT_FOUND\b/.test(error?.message ?? "");
      if (!contextMissing) throw error;
      // This anchor contains no user prompt, provider credential, server path, or
      // mutable instruction.  It is created only after all human, binding,
      // provider-health, and Test-spend gates above have passed.  It closes the
      // otherwise empty project-memory bootstrap gap without weakening context
      // assembly for any non-empty or stale context.
      if (!dashboard.findProjectMemory({ projectId, memoryKey: "live-advisor.context-v1" })) {
        dashboard.recordProjectMemory({
          memoryId: `live-advisor-context-v1-${projectId}`,
          projectId,
          memoryKey: "live-advisor.context-v1",
          kind: "rule",
          scope: "project",
          status: "approved",
          content: "Live advisor requests may use only redacted project-scoped metadata. User questions, secrets, credentials, host paths, and executable actions are never stored in this context.",
          tags: ["live-advisor", "redacted"],
          recipientRoles: ["planner"],
          source: { kind: "policy", reference: "hero://ai/live-advisor-context-v1", documentVersion: authorization.documentVersion },
          idempotencyKey: `live-advisor-context-v1-${projectId}`
        });
      }
      result = await dispatch();
    }
    if (result?.invocation?.status !== "completed") {
      const code = result?.invocation?.code ?? "UNKNOWN";
      throw new ProjectWorkspaceError("LIVE_ADVISOR_INVOCATION_FAILED", `${liveAdvisorFailureMessage(code, result?.invocation?.reason)} کد امن: ${code}.`, 502);
    }
    const structuredResult = liveAdvisorResult(result.invocation);
    return Object.freeze({
      response: structuredResult.answer,
      result: structuredResult,
      invocationId: result.invocation.invocationId,
      costUnits: result.invocation.accountedCostUnits ?? null,
      evidence: liveAdvisorEvidence({ purpose, projectId, selectedProfile, binding, invocation: result.invocation, result: structuredResult })
    });
  }

  function projectControlSnapshot(projectId) {
    const actor = { subject: identityOwner.userId, role: "project-owner" };
    const project = projectWorkspace.getProject(projectId);
    const row = (title, state, meta) => Object.freeze({ title, state: String(state ?? "unknown"), meta: String(meta ?? "") });
    const collaborationTeams = projectCollaboration.listTeams({ actor, projectId });
    const memory = projectCollaboration.retrieveMemory({ actor, projectId });
    const operations = commandCenter.operations({ actor, projectId });
    const entities = systemCatalog.list({ projectId });
    const ledger = performanceIntelligence.ledger({ actor, projectId });
    const health = performanceIntelligence.health({ actor, projectId });
    const inbox = notificationObservability.inbox({ actor, projectId, view: "all" });
    const observability = notificationObservability.observability({ actor, projectId });
    const infrastructure = infrastructureControl.view({ actor, projectId });
    const delivery = deliveryControl.view({ actor, projectId });
    const hardening = operationalHardening.report({ actor, projectId });
    const readiness = finalReadiness.view({ actor, projectId });
    const readinessState = readiness.reviews.at(-1)?.state ?? (readiness.acceptance.at(-1)?.decision ?? "draft");
    return Object.freeze({
      project: Object.freeze({ projectId: project.projectId, name: project.name, lifecycle: project.lifecycle }),
      metrics: Object.freeze({
        teams: collaborationTeams.filter(team => team.assignment?.status === "active").length,
        commands: operations.queue.length + operations.completed.length,
        entities: entities.length,
        notifications: inbox.filter(item => item.state === "open").length,
        readiness: readinessState
      }),
      collaboration: Object.freeze({
        teams: Object.freeze([
          ...collaborationTeams.map(team => row(team.name, team.assignment?.status ?? "unassigned", `teamId: ${team.teamId}`)),
          row("Project memory", "metadata-only", `${memory.length} active entry; content is never rendered here`)
        ])
      }),
      commands: Object.freeze({
        items: Object.freeze([
          ...operations.queue.map(item => row(item.commandId, item.state, `priority: ${item.priority} · attempts: ${item.attempts}`)),
          ...operations.completed.map(item => row(item.commandId, item.state, `completed: ${item.completedAt ?? "recorded"}`)),
          ...operations.approvals.map(item => row(item.commandId, item.state, `expires: ${item.expiresAt}`)),
          row("Queue policy", "bounded", `heavy runs: ${operations.heavyRunLimit} · locks: ${operations.locks.length}`)
        ])
      }),
      catalog: Object.freeze({
        items: Object.freeze(entities.map(entity => row(entity.entityId, entity.state ?? "registered", `type: ${entity.type}`)))
      }),
      performance: Object.freeze({
        items: Object.freeze([
          row("Health", health.status, `score: ${health.score ?? "—"} · confidence: ${health.confidence}`),
          row("Token usage", "observed", `total: ${health.tokenUsage} · budget: ${health.budget?.hardCap ?? "not-set"}`),
          ...ledger.map(item => row(item.scope, "ledger", `tokens: ${item.totalTokens} · events: ${item.events}`))
        ])
      }),
      observability: Object.freeze({
        items: Object.freeze([
          ...inbox.map(item => row(item.notificationId, item.state, `severity: ${item.severity} · category: ${item.category}`)),
          ...observability.sli.map(item => row(item.projection, item.status, `lag: ${item.lagSeconds}s · freshness: ${item.freshnessSeconds}s`)),
          row("Audit & trace", "redacted", `audit: ${observability.auditCount} · traces: ${observability.traceCount}`)
        ])
      }),
      infrastructure: Object.freeze({
        items: Object.freeze([
          ...infrastructure.environments.map(environment => row(environment, "defined", "desired/observed state is project-scoped")),
          row("Repositories", "metadata-only", `${infrastructure.repositories.length} registered; no GitHub fetch`),
          row("Servers", "plan-only", `${infrastructure.servers.length} registered; no connection executed`),
          ...infrastructure.targetSelections.map(selection => row(`Target ${selection.serverId}`, selection.state, `Test · version ${selection.version} · separate Product Test authorization required`)),
          row("Nodes", "identity-bound", `${infrastructure.nodes.length} enrolled`),
          row("Secret references", "never-revealed", `${infrastructure.secrets.length} reference-only record`),
          row("Egress", infrastructure.egress?.default ?? "not-configured", `${infrastructure.egress?.domains?.length ?? 0} allowed domain record`)
        ]),
        servers: Object.freeze(infrastructure.servers.map(server => Object.freeze({ serverId: server.serverId, address: server.address, environment: server.environment, state: server.state }))),
        targetSelections: Object.freeze(infrastructure.targetSelections.map(selection => Object.freeze({ selectionId: selection.selectionId, projectId: selection.projectId, environment: selection.environment, serverId: selection.serverId, serverAddress: selection.serverAddress, version: selection.version, state: selection.state, execution: selection.execution })))
      }),
      delivery: Object.freeze({
        items: Object.freeze([
          ...delivery.releases.map(item => row(item.releaseId, item.state, `tested commit: ${item.testedCommit}`)),
          ...delivery.artifacts.map(item => row(item.artifactId, "registered", `digest: ${item.digest.slice(0, 20)}…`)),
          ...delivery.bundles.map(item => row(item.bundleId, item.state, `artifacts: ${item.artifactIds.length}`)),
          ...delivery.rehearsals.map(item => row(item.kind, item.result, `bundle: ${item.bundleId}`)),
          ...delivery.acceptance.map(item => row(item.acceptanceId, item.delivery, `bundle: ${item.bundleId}`))
        ])
      }),
      hardening: Object.freeze({
        items: Object.freeze([
          row("Retention", hardening.retention ? "configured" : "not-configured", hardening.retention ? `version: ${hardening.retention.version}` : "minimum policy not recorded"),
          ...hardening.cleanup.map(item => row(item.jobId, item.hold ? "hold" : "dry-run", `candidates: ${item.candidates.length}`)),
          ...hardening.audits.map(item => row(item.kind, item.passed ? "passed" : "attention", `auditId: ${item.auditId}`)),
          row("Coverage", hardening.coverage.missing.length ? "attention" : "complete", `missing: ${hardening.coverage.missing.join(", ") || "none"}`)
        ])
      }),
      readiness: Object.freeze({
        items: Object.freeze([
          ...readiness.migrations.map(item => row(item.migrationId, "planned", `compatibility until: ${item.compatibilityUntil}`)),
          ...readiness.readModels.map(item => row(item.modelId, item.equal ? "equal" : "mismatch", "deterministic rebuild comparison")),
          ...readiness.scenarios.map(item => row(item.kind, item.passed ? "passed" : "failed", `scenario: ${item.scenarioId}`)),
          ...readiness.reviews.map(item => row(item.reviewId, item.state, `scenario coverage: ${item.scenarioCoverage.filter(entry => entry.passed).length}/${item.scenarioCoverage.length}`)),
          ...readiness.acceptance.map(item => row(item.reviewId, item.decision, "owner decision record")),
          ...readiness.pilotProposals.map(item => row(item.proposalId, item.state, item.execution))
        ])
      })
    });
  }

  function portfolioSnapshot(principal = null, { view = "active" } = {}) {
    const accessible = principal?.source === "human-identity" ? projectAccessRegistry.listAccessibleProjectIds({ principal }) : null;
    const archiveView = view === "archived";
    const visibleProjects = projectWorkspace.listProjects().filter(project => accessible === null || accessible.includes(project.projectId));
    const projects = visibleProjects.filter(project => archiveView ? project.lifecycle === "archived" : project.lifecycle !== "archived");
    const model = rebuildPortfolioReadModel({ projects });
    const cards = model.projects.map(project => ({
      projectId: project.projectId,
      name: project.name,
      version: project.version,
      lifecycle: project.lifecycle,
      health: project.health,
      roadmap: project.nextTasks,
      tokenUsage: project.tokenUsage,
      latestCompletedTask: project.latestCompletedTask,
      latestOutput: project.latestOutput,
      drillDown: { href: `/product-studio?projectId=${encodeURIComponent(project.projectId)}`, projectId: project.projectId }
    }));
    return Object.freeze({ ...model, cards, archiveCount: visibleProjects.filter(project => project.lifecycle === "archived").length, view: archiveView ? "archived" : "active", informationArchitecture: ["Portfolio", "Project Studio", "Overview", "Roadmap", "Inputs", "Settings", "Outputs"] });
  }

  function pruneSmartTesterReports() {
    const nowMs = Date.now();
    for (const [reportId, value] of smartTesterReports) {
      if (!value || value.expiresAt <= nowMs) smartTesterReports.delete(reportId);
    }
    for (const [reportId, value] of smartTesterErrorReports) {
      if (!value || value.expiresAt <= nowMs) smartTesterErrorReports.delete(reportId);
    }
  }

  function smartTesterContextMatches(reportContext, context) {
    return reportContext?.pathname === context.pathname &&
      reportContext?.featureKey === context.featureKey &&
      reportContext?.boxId === context.boxId &&
      reportContext?.projectId === context.projectId;
  }

  /**
   * This is deliberately an in-process read/render probe, not a shell or
   * browser test runner. It exercises the same view data contracts without
   * allowing a UI control to execute arbitrary commands or external calls.
   */
  function smartTesterProbe(context, principal) {
    try {
      let renderedHtml;
      if (context.pathname === "/portfolio") {
        renderedHtml = getPortfolioHtml({ portfolio: portfolioSnapshot(principal) });
      } else if (context.pathname === "/product-studio") {
        if (!context.projectId) return { renderedHtml: "", backendProbe: { ok: false, detail: "Scope پروژه انتخاب نشده است؛ خوانش Studio انجام نشد." } };
        renderedHtml = getProductStudioHtml({ initialData: productStudioSnapshot({ projectId: context.projectId }) });
      } else if (context.pathname === "/workspace") {
        if (!context.projectId) return { renderedHtml: "", backendProbe: { ok: false, detail: "Scope پروژه انتخاب نشده است؛ خوانش Workspace انجام نشد." } };
        projectOverview(context.projectId);
        renderedHtml = getProjectWorkspaceHtml({ projectId: context.projectId });
      } else if (context.pathname === "/project-control") {
        if (!context.projectId) return { renderedHtml: "", backendProbe: { ok: false, detail: "Scope پروژه انتخاب نشده است؛ خوانش Operations انجام نشد." } };
        renderedHtml = getProjectControlRoomHtml({ initialData: { controlRoom: projectControlSnapshot(context.projectId) } });
      } else if (context.pathname === "/command") {
        if (!context.projectId) return { renderedHtml: "", backendProbe: { ok: false, detail: "Scope پروژه انتخاب نشده است؛ خوانش مرکز فرمان انجام نشد." } };
        renderedHtml = getProjectControlRoomHtml({ initialData: { service: HERO_SERVICE, controlRoom: projectControlSnapshot(context.projectId) }, active: "backoffice", heading: "مرکز فرمان", environment: "Private · Command" });
      } else if (context.pathname === "/ai") {
        renderedHtml = getBackofficeHtml({ initialData: backofficeSnapshot(), active: "ai" });
      } else if (context.pathname === "/identity") {
        renderedHtml = getIdentityHtml();
      } else if (context.pathname === "/walkthrough") {
        renderedHtml = getProjectWalkthroughHtml({ projectId: context.projectId });
      } else {
        renderedHtml = getBackofficeHtml({ initialData: backofficeSnapshot() });
      }
      return {
        renderedHtml,
        backendProbe: { ok: true, detail: "قرارداد داده و render همین سطح از طریق مسیر داخلی و بدون side effect خوانده شد." }
      };
    } catch (error) {
      return {
        renderedHtml: "",
        backendProbe: { ok: false, detail: `خوانش امن این بخش ناموفق بود: ${error?.code ?? error?.name ?? "UNKNOWN_ERROR"}.` }
      };
    }
  }

  function storeSmartTesterReport({ principal, report }) {
    pruneSmartTesterReports();
    const reportId = crypto.randomUUID();
    smartTesterReports.set(reportId, Object.freeze({
      principalSubject: principal.subject,
      context: report.context,
      report,
      expiresAt: Date.now() + HERO_SMART_TESTER_REPORT_TTL_MS
    }));
    const expiry = setTimeout(() => smartTesterReports.delete(reportId), HERO_SMART_TESTER_REPORT_TTL_MS);
    expiry.unref?.();
    return reportId;
  }

  function readSmartTesterReport({ principal, reportId, context }) {
    if (reportId === undefined || reportId === null || reportId === "") return null;
    if (typeof reportId !== "string" || !/^[0-9a-f-]{36}$/i.test(reportId)) {
      throw new ProjectWorkspaceError("SMART_TESTER_REPORT_INVALID", "Smart Tester report reference is invalid.", 400);
    }
    pruneSmartTesterReports();
    const stored = smartTesterReports.get(reportId);
    if (!stored || stored.principalSubject !== principal.subject || !smartTesterContextMatches(stored.context, context)) {
      throw new ProjectWorkspaceError("SMART_TESTER_REPORT_UNAVAILABLE", "Smart Tester report is unavailable for this scope.", 404);
    }
    return stored.report;
  }

  function storeSmartTesterErrorReport({ principal, report }) {
    pruneSmartTesterReports();
    const reportId = crypto.randomUUID();
    smartTesterErrorReports.set(reportId, Object.freeze({
      principalSubject: principal.subject,
      context: report.context,
      report,
      expiresAt: Date.now() + HERO_SMART_TESTER_REPORT_TTL_MS
    }));
    const expiry = setTimeout(() => smartTesterErrorReports.delete(reportId), HERO_SMART_TESTER_REPORT_TTL_MS);
    expiry.unref?.();
    return reportId;
  }

  function readSmartTesterErrorReport({ principal, reportId, context }) {
    if (typeof reportId !== "string" || !/^[0-9a-f-]{36}$/i.test(reportId)) {
      throw new ProjectWorkspaceError("SMART_TESTER_ERROR_REPORT_INVALID", "Smart Tester error report reference is invalid.", 400);
    }
    pruneSmartTesterReports();
    const stored = smartTesterErrorReports.get(reportId);
    if (!stored || stored.principalSubject !== principal.subject || !smartTesterContextMatches(stored.context, context)) {
      throw new ProjectWorkspaceError("SMART_TESTER_ERROR_REPORT_UNAVAILABLE", "Smart Tester error report is unavailable for this scope.", 404);
    }
    return stored.report;
  }

  async function appendSmartTesterErrorDocument({ principal, report }) {
    const projectId = report?.context?.projectId;
    if (typeof projectId !== "string" || projectId.length === 0) {
      throw new ProjectWorkspaceError("SMART_TESTER_PROJECT_REQUIRED", "برای ثبت خطا، ابتدا یک پروژه را انتخاب کنید.", 400);
    }
    const errorId = `error-${crypto.randomUUID()}`;
    const documentId = `smart-tester-errors:${projectId}`;
    const entry = Object.freeze({
      errorId,
      reportVersion: report.version,
      generatedAt: report.generatedAt,
      surface: report.context.pathname,
      featureKey: report.context.featureKey,
      severity: report.summary.severity,
      state: report.summary.state,
      summary: report.summary.statement,
      findings: report.findings,
      reproductionSteps: report.reproductionSteps,
      limitations: report.limitations,
      sourceReport: report.sourceReport,
      diagnosis: report.diagnosis ?? null,
      incident: report.incident ?? null,
      remediationBrief: report.remediationBrief ?? null,
      qualityOpportunities: report.qualityOpportunities ?? []
    });
    const current = smartTesterErrorDocuments.get(documentId) ?? Object.freeze({
      documentId,
      projectId,
      title: `دفتر خطاهای Smart Tester · ${projectId}`,
      entries: Object.freeze([])
    });
    const next = Object.freeze({ ...current, entries: Object.freeze([...current.entries, entry]), updatedAt: new Date().toISOString() });
    if (postgresRuntime?.projectWorkspace?.appendSmartTesterError) {
      await postgresRuntime.projectWorkspace.appendSmartTesterError({
        projectId,
        errorId,
        reportVersion: report.version,
        title: current.title,
        surface: entry.surface,
        featureKey: entry.featureKey,
        severity: entry.severity,
        summary: entry.summary,
        findings: entry.findings,
        reproductionSteps: entry.reproductionSteps,
        limitations: entry.limitations,
        sourceReport: {
          ...entry.sourceReport,
          diagnosis: entry.diagnosis,
          incident: entry.incident,
          remediationBrief: entry.remediationBrief,
          qualityOpportunities: entry.qualityOpportunities
        },
        actorId: principal.subject
      });
    }
    // Publish to the transient read cache only after durable persistence succeeds.
    // This prevents a failed database write from exposing a phantom error entry.
    smartTesterErrorDocuments.set(documentId, next);
    return Object.freeze({ documentId, projectId, title: current.title, entry, entryCount: next.entries.length, persistence: postgresRuntime?.projectWorkspace?.appendSmartTesterError ? "postgresql-and-runtime" : "runtime-until-restart" });
  }

  async function readSmartTesterErrorDocument({ projectId }) {
    const documentId = `smart-tester-errors:${projectId}`;
    const current = smartTesterErrorDocuments.get(documentId);
    if (current) return current;
    if (postgresRuntime?.projectWorkspace?.listSmartTesterErrors) {
      const entries = await postgresRuntime.projectWorkspace.listSmartTesterErrors({ projectId });
      return Object.freeze({ documentId, projectId, title: `دفتر خطاهای Smart Tester · ${projectId}`, entries: Object.freeze(entries.map(entry => Object.freeze({
        ...entry,
        diagnosis: entry.sourceReport?.diagnosis ?? null,
        incident: entry.sourceReport?.incident ?? null,
        remediationBrief: entry.sourceReport?.remediationBrief ?? null,
        qualityOpportunities: entry.sourceReport?.qualityOpportunities ?? []
      }))) });
    }
    return Object.freeze({ documentId, projectId, title: `دفتر خطاهای Smart Tester · ${projectId}`, entries: Object.freeze([]) });
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

  function authenticateApiPrincipal(authorizationHeader, cookieHeader) {
    const authorization = typeof authorizationHeader === "string" ? authorizationHeader.trim() : "";
    // Browser Basic Auth protects page delivery in Test. It is intentionally
    // not an application principal, so it must not prevent cookie-based human
    // authentication when a browser forwards it to an API request.
    if (authorization && !/^Basic\s+/i.test(authorization)) {
      try {
        const owner = ownerAuth.requireOwner(authorization);
        return Object.freeze({ ...owner, actor: Object.freeze({ kind: "project-owner", id: owner.subject }) });
      } catch (ownerError) {
        if (adminAuth.configured) {
          try {
            const admin = adminAuth.requireAdmin(authorization);
            return Object.freeze({ ...admin, actor: Object.freeze({ kind: "admin", id: admin.subject }) });
          } catch {
            // The explicit token may still be a Human Identity token.
          }
        }
        if (humanIdentity?.configured) {
          try {
            return projectAccessMiddleware.authenticate(authorization);
          } catch (identityError) {
            if (identityError instanceof HumanIdentityError) throw identityError;
          }
        }
        throw ownerError;
      }
    }
    if (humanIdentity?.configured) {
      const token = parseCookie(cookieHeader, HUMAN_SESSION_COOKIE_NAME);
      if (token) {
        const principal = projectAccessMiddleware.authenticate(`Bearer ${token}`);
        return Object.freeze({ ...principal, authTransport: "cookie" });
      }
    }
    return ownerAuth.requireOwner(authorization);
  }

  // Browser navigation must be bound to the same HttpOnly Human Identity
  // session as in-page API calls. Do not accept Basic Auth here: Basic is a
  // transport gate only and accepting it as a portal principal would bypass
  // MFA and project-scoped authorization.
  function authenticateBrowserPortalPrincipal(request) {
    if (!humanIdentity?.configured || !projectAccessMiddleware) return null;
    const token = parseCookie(request.headers.cookie, HUMAN_SESSION_COOKIE_NAME);
    if (!token) return null;
    try {
      return Object.freeze({ ...projectAccessMiddleware.authenticate(`Bearer ${token}`), authTransport: "cookie" });
    } catch {
      return null;
    }
  }

  function portalSurface(value) {
    return BROWSER_PORTAL_SURFACES.has(value) ? value : null;
  }

  function safePortalReturnPath(value) {
    if (typeof value !== "string" || value.length === 0 || value.length > 2048) return null;
    let candidate;
    try { candidate = new URL(value, "http://hero.invalid"); } catch { return null; }
    if (candidate.origin !== "http://hero.invalid" || candidate.pathname !== BROWSER_PORTAL_PATH || !portalSurface(candidate.searchParams.get("surface") ?? "portfolio")) return null;
    return `${candidate.pathname}${candidate.search}`;
  }

  function portalIdentityLocation(returnTo) {
    const url = new URL(BROWSER_PORTAL_PATH, "http://hero.invalid");
    url.searchParams.set("surface", "identity");
    if (returnTo) url.searchParams.set("returnTo", returnTo);
    return `${url.pathname}${url.search}`;
  }

  function requirePortalProjectScope(principal, projectId) {
    if (!projectId) throw new ProjectWorkspaceError("PROJECT_SCOPE_REQUIRED", "A projectId is required for this browser surface.", 400);
    if (!projectAccessMiddleware) throw new HumanIdentityError("IDENTITY_NOT_CONFIGURED", "Project identity is not configured.", 503);
    projectAccessMiddleware.requireProject({ principal, projectId, action: "project.read" });
  }

  function assertCookieMutationOrigin(request, principal) {
    if (principal?.authTransport !== "cookie" || ["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
    const origin = request.headers.origin;
    const host = request.headers.host;
    if (typeof origin !== "string" || typeof host !== "string" || !origin || !host) {
      throw new HumanIdentityError("IDENTITY_CSRF_ORIGIN_REQUIRED", "A same-origin browser request is required for this action.", 403);
    }
    let parsed;
    try {
      parsed = new URL(origin);
    } catch {
      throw new HumanIdentityError("IDENTITY_CSRF_ORIGIN_REQUIRED", "A same-origin browser request is required for this action.", 403);
    }
    if (!/^https?:$/.test(parsed.protocol) || parsed.host !== host) {
      throw new HumanIdentityError("IDENTITY_CSRF_ORIGIN_REQUIRED", "A same-origin browser request is required for this action.", 403);
    }
  }

  function assertApiPermission(request, url, principal) {
    if (principal.source === "human-identity") {
      if (url.pathname.startsWith("/api/identity/")) return;
      if ((HUMAN_OWNER_GLOBAL_AI_MUTATIONS.has(url.pathname) || /^\/api\/ai\/providers\/[a-z][a-z0-9-]{2,63}\/health$/.test(url.pathname)) && request.method === "POST") {
        if (principal.role !== "project-owner") {
          throw new ProjectAccessError("OWNER_REQUIRED", "تنظیم اتصال و کاتالوگ سراسری AI فقط با دسترسی مالک مجاز است.", 403);
        }
        return;
      }
      if (url.pathname === "/api/ai/project-scopes" && request.method === "POST") {
        if (!["project-owner", "admin"].includes(principal.role)) {
          throw new ProjectAccessError("ADMIN_REQUIRED", "تنظیم Scope پروژهٔ AI فقط برای Owner یا Admin مجاز است.", 403);
        }
        return;
      }
      if ((url.pathname === "/api/ai/credentials" || /^\/api\/ai\/credentials\/[a-z][a-z0-9-]{2,63}\/(?:status|health)$/.test(url.pathname)) && ["GET", "POST"].includes(request.method)) {
        if (principal.role !== "project-owner") {
          throw new ProjectAccessError("OWNER_REQUIRED", "مدیریت کلیدهای AI فقط با دسترسی مالک مجاز است.", 403);
        }
        return;
      }
      // Smart Tester can inspect Hero's own UI/data contracts. It is more
      // privileged than ordinary project guidance, so only the primary Owner
      // can use it. It never gains write, shell, provider or deployment power.
      if (url.pathname.startsWith("/api/smart-tester/")) {
        if (principal.role !== "project-owner") {
          throw new ProjectAccessError("OWNER_REQUIRED", "Smart Tester only runs for the Hero owner.", 403);
        }
        const projectId = url.searchParams.get("projectId");
        if (projectId) {
          const action = url.pathname === "/api/smart-tester/errors/submit" && request.method === "POST" ? "project.write" : "project.read";
          projectAccessMiddleware.requireProject({ principal, projectId, action });
        }
        return;
      }
      // The Walk-Through advisor is read-only and transient.  It needs the
      // current project only to enforce the same Project Grant boundary as the
      // page being guided; it must not be treated as a write merely because a
      // user sends a question with POST.
      if (url.pathname === "/api/walkthrough/advice" && request.method === "POST") {
        const projectId = url.searchParams.get("projectId");
        if (projectId) projectAccessMiddleware.requireProject({ principal, projectId, action: "project.read" });
        return;
      }
      if ((url.pathname.startsWith("/api/form-suggestions") || url.pathname.startsWith("/api/advisor")) && ["GET", "POST"].includes(request.method)) {
        if (!principal || !["human-identity", "admin"].includes(principal.source)) {
          throw new HumanIdentityError("IDENTITY_AUTH_REQUIRED", "Human or admin authentication is required for form suggestions.", 401);
        }
        if (!["project-owner", "admin"].includes(principal.role)) {
          throw new ProjectAccessError("ADMIN_REQUIRED", "Advisor فقط برای Owner یا Admin مجاز است.", 403);
        }
        const scopedProjectId = url.searchParams.get("projectId");
        if (scopedProjectId) projectAccessMiddleware.requireProject({ principal, projectId: scopedProjectId, action: request.method === "GET" ? "project.read" : "project.write" });
        return;
      }
      // Creation-time advice is strictly transient: it is available after the
      // first five project answers, before a Project exists to scope. It may
      // fill the remaining form fields but cannot dispatch a live provider,
      // create a Project, or write an AI binding.
      if (url.pathname.startsWith("/api/project-intake-advisor") && ["GET", "POST"].includes(request.method)) {
        if (!principal || !["human-identity", "admin"].includes(principal.source)) {
          throw new HumanIdentityError("IDENTITY_AUTH_REQUIRED", "Human or admin authentication is required for intake advice.", 401);
        }
        if (!["project-owner", "admin"].includes(principal.role)) {
          throw new ProjectAccessError("ADMIN_REQUIRED", "Advisor فقط برای Owner یا Admin مجاز است.", 403);
        }
        return;
      }
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
      // Older control-plane routes also serve established projects that
      // predate Project Workspace.  Reject only a known purged scope here:
      // treating every legacy project as absent would turn valid owner and
      // human-session routes into 404s.  A tombstoned project still behaves
      // as absent and cannot be recreated through a stale URL.
      if (projectMatch && projectWorkspace.isPurgedProject?.(projectId)) {
        throw new ProjectWorkspaceError("PROJECT_NOT_FOUND", "Project was not found.", 404);
      }
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
    try {
      await postgresRuntime.projectIdentity.recordAudit({ auditId: `identity-audit-${crypto.randomUUID()}`, userId, eventType, outcome, data });
    } catch (error) {
      console.error(JSON.stringify({ level: "error", event: "hero.identity-audit-failed", eventType, outcome, hasUserId: Boolean(userId), code: error?.code ?? "IDENTITY_AUDIT_PERSISTENCE_FAILED" }));
      throw new HeroSecretStoreError("IDENTITY_AUDIT_PERSISTENCE_FAILED", "ثبت ممیزی هویت در PostgreSQL انجام نشد.", 503);
    }
  }

  function identityStatusSnapshot() {
    const configured = humanIdentity?.configured === true;
    return Object.freeze({
      configured,
      humanLoginAvailable: configured,
      networkBoundary: backofficeAuth ? "human-session-portal-with-legacy-basic" : "local-development",
      ownerMfaRequired: true,
      totp: "rfc6238-base32-with-legacy-verification",
      persistence: postgresRuntime?.projectIdentity ? "postgresql" : "not-connected",
      recoveryDelivery: "not-configured",
      sessionTtlSeconds: HUMAN_IDENTITY_SESSION_TTL_SECONDS
    });
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
      const projectControlPath = PROJECT_CONTROL_PATHS.has(url.pathname);
      const projectWorkspacePath = PROJECT_WORKSPACE_PATHS.has(url.pathname);
      const portfolioPath = PORTFOLIO_PATHS.has(url.pathname);
      const walkthroughPath = WALKTHROUGH_PATHS.has(url.pathname);
      const identityPath = IDENTITY_PATHS.has(url.pathname);
      if (backofficePath || productStudioPath || projectControlPath || projectWorkspacePath || portfolioPath || walkthroughPath || identityPath) {
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
      if ((backofficePath || productStudioPath || projectControlPath || projectWorkspacePath || portfolioPath || walkthroughPath || identityPath) && backofficeAuth && !matchesBasicAuth(basicCredentials(request), backofficeAuth)) {
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
      if ((backofficePath || productStudioPath || projectControlPath || projectWorkspacePath || portfolioPath || walkthroughPath || identityPath) && request.method !== "GET") {
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

      if (request.method === "GET" && url.pathname === "/api/ui-assets/vazirmatn.woff2") {
        return binary(response, 200, VAZIRMATN_FONT, "font/woff2", { cacheControl: "public, max-age=31536000, immutable" });
      }

      if (request.method === "GET" && url.pathname === BROWSER_PORTAL_PATH) {
        const surface = portalSurface(url.searchParams.get("surface") ?? "portfolio");
        if (!surface) return plain(response, 404, "Hero browser portal surface not found.");
        if (surface === "identity") {
          const postLoginHref = safePortalReturnPath(url.searchParams.get("returnTo")) ?? "/api/portal?surface=portfolio&select=project";
          return html(response, getIdentityHtml({ postLoginHref, portalEntry: true }));
        }
        const principal = authenticateBrowserPortalPrincipal(request);
        if (!principal) return redirect(response, portalIdentityLocation(`${url.pathname}${url.search}`));
        const projectId = url.searchParams.get("projectId");
        if (["command", "studio", "workspace", "control", "walkthrough"].includes(surface) && !projectId) {
          return redirect(response, "/api/portal?surface=portfolio&select=project&next=" + encodeURIComponent(surface));
        }
        if (["command", "studio", "workspace", "control", "walkthrough"].includes(surface)) requirePortalProjectScope(principal, projectId);
        if (surface === "portfolio") {
          const destinationCandidate = url.searchParams.get("next") ?? url.searchParams.get("open");
          const destination = ["command", "studio", "workspace", "control", "walkthrough"].includes(destinationCandidate) ? destinationCandidate : null;
          const view = url.searchParams.get("view") === "archived" ? "archived" : "active";
          return html(response, getPortfolioHtml({ portfolio: portfolioSnapshot(principal, { view }), destination, selectionRequired: url.searchParams.get("select") === "project" || Boolean(destination), archiveView: view === "archived" }));
        }
        if (surface === "command") {
          return html(response, getProjectControlRoomHtml({
            initialData: { service: HERO_SERVICE, controlRoom: projectControlSnapshot(projectId) },
            dataEndpoint: `${BROWSER_PORTAL_DATA_PATH}?surface=command`,
            active: "backoffice",
            heading: "مرکز فرمان",
            environment: "Private · Command"
          }));
        }
        if (surface === "studio") return html(response, getProductStudioHtml({ initialData: productStudioSnapshot({ projectId }), dataEndpoint: `${BROWSER_PORTAL_DATA_PATH}?surface=studio`, documentEndpoint: `${BROWSER_PORTAL_DOCUMENT_PATH}?surface=studio` }));
        if (surface === "workspace") return html(response, getProjectWorkspaceHtml({ projectId }));
        if (surface === "control") return html(response, getProjectControlRoomHtml({ initialData: { service: HERO_SERVICE, controlRoom: projectControlSnapshot(projectId) }, dataEndpoint: `${BROWSER_PORTAL_DATA_PATH}?surface=control` }));
        if (surface === "walkthrough") return html(response, getProjectWalkthroughHtml({ projectId }));
        if (surface === "ai") {
          if (principal.role !== "project-owner") throw new ProjectAccessError("OWNER_REQUIRED", "The global AI catalog is available only to the Owner.", 403);
          return html(response, getBackofficeHtml({ initialData: backofficeSnapshot(), dataEndpoint: `${BROWSER_PORTAL_DATA_PATH}?surface=ai`, active: "ai" }));
        }
      }

      if (request.method === "GET" && url.pathname === BROWSER_PORTAL_DATA_PATH) {
        const surface = portalSurface(url.searchParams.get("surface"));
        const principal = authenticateBrowserPortalPrincipal(request);
        if (!surface || surface === "identity" || !principal) {
          return json(response, 401, { code: "HUMAN_SESSION_REQUIRED", message: "A current Human Identity browser session is required." });
        }
        const projectId = url.searchParams.get("projectId");
        if (surface === "ai") {
          if (principal.role !== "project-owner") throw new ProjectAccessError("OWNER_REQUIRED", "The global AI catalog is available only to the Owner.", 403);
          return json(response, 200, { service: HERO_SERVICE, backoffice: backofficeSnapshot() }, { maxBytes: backofficeResponseLimitBytes });
        }
        if (surface === "portfolio") return json(response, 200, { service: HERO_SERVICE, portfolio: portfolioSnapshot(principal, { view: url.searchParams.get("view") === "archived" ? "archived" : "active" }) }, { maxBytes: backofficeResponseLimitBytes });
        if (!["command", "studio", "workspace", "control", "walkthrough"].includes(surface)) return plain(response, 404, "Hero browser portal data surface not found.");
        requirePortalProjectScope(principal, projectId);
        if (surface === "studio") return json(response, 200, productStudioSnapshot({ projectId }), { maxBytes: backofficeResponseLimitBytes });
        if (surface === "command" || surface === "control") return json(response, 200, { service: HERO_SERVICE, controlRoom: projectControlSnapshot(projectId) }, { maxBytes: backofficeResponseLimitBytes });
        if (surface === "workspace") return json(response, 200, { service: HERO_SERVICE, overview: projectOverview(projectId) }, { maxBytes: backofficeResponseLimitBytes });
        return json(response, 200, { service: HERO_SERVICE, projectId, status: "browser-guide-data-not-required" });
      }

      if (request.method === "GET" && url.pathname === BROWSER_PORTAL_DOCUMENT_PATH) {
        const principal = authenticateBrowserPortalPrincipal(request);
        const projectId = url.searchParams.get("projectId");
        if (!principal) return json(response, 401, { code: "HUMAN_SESSION_REQUIRED", message: "A current Human Identity browser session is required." });
        if (portalSurface(url.searchParams.get("surface")) !== "studio") return plain(response, 404, "Hero browser portal document surface not found.");
        requirePortalProjectScope(principal, projectId);
        const documentId = url.searchParams.get("documentId");
        if (!documentId) throw new ProductDevelopmentError("DOCUMENT_ID_REQUIRED", "documentId is required.", 400);
        return json(response, 200, { service: HERO_SERVICE, document: productDevelopment.document(documentId) }, { maxBytes: backofficeResponseLimitBytes });
      }

      if (request.method === "GET" && url.pathname === "/backoffice") {
        if (url.searchParams.get("surface") === "ai") {
          // Preserve old bookmarks once they arrive at Hero, without keeping
          // the legacy route in application navigation.
          return redirect(response, "/portfolio?surface=ai");
        }
        return redirect(response, "/portfolio?select=project");
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
        const projectId = url.searchParams.get("projectId");
        if (!projectId) return redirect(response, "/portfolio?select=project&next=studio");
        await recordReadAccess("/product-studio", "accepted", { kind: backofficeAuth ? "backoffice-basic-auth" : "project-owner", id: backofficeAuth ? "backoffice-user" : "development-local" });
        return html(response, getProductStudioHtml({ initialData: productStudioSnapshot({ projectId }) }));
      }

      if (request.method === "GET" && url.pathname === "/product-studio-data") {
        const projectId = url.searchParams.get("projectId");
        if (!projectId) throw new ProjectWorkspaceError("PROJECT_SCOPE_REQUIRED", "A projectId is required for Product Studio.", 400);
        await recordReadAccess("/product-studio-data", "accepted", { kind: backofficeAuth ? "backoffice-basic-auth" : "project-owner", id: backofficeAuth ? "backoffice-user" : "development-local" });
        return json(response, 200, productStudioSnapshot({ projectId }), { maxBytes: backofficeResponseLimitBytes });
      }

      if (request.method === "GET" && url.pathname === "/product-studio-document") {
        const projectId = url.searchParams.get("projectId");
        if (!projectId) throw new ProjectWorkspaceError("PROJECT_SCOPE_REQUIRED", "A projectId is required for Product Studio documents.", 400);
        await recordReadAccess("/product-studio-document", "accepted", { kind: backofficeAuth ? "backoffice-basic-auth" : "project-owner", id: backofficeAuth ? "backoffice-user" : "development-local" });
        const documentId = url.searchParams.get("documentId");
        if (!documentId) throw new ProductDevelopmentError("DOCUMENT_ID_REQUIRED", "documentId is required.", 400);
        return json(response, 200, { service: HERO_SERVICE, document: productDevelopment.document(documentId) }, { maxBytes: backofficeResponseLimitBytes });
      }

      if (request.method === "GET" && url.pathname === "/project-control") {
        const projectId = url.searchParams.get("projectId");
        if (!projectId) return redirect(response, "/portfolio?select=project&next=control");
        await recordReadAccess("/project-control", "accepted", { kind: backofficeAuth ? "backoffice-basic-auth" : "project-owner", id: backofficeAuth ? "backoffice-user" : "development-local" });
        return html(response, getProjectControlRoomHtml({ initialData: { service: HERO_SERVICE, controlRoom: projectControlSnapshot(projectId) } }));
      }

      if (request.method === "GET" && url.pathname === "/project-control-data") {
        const projectId = url.searchParams.get("projectId");
        if (!projectId) throw new ProjectWorkspaceError("PROJECT_ID_REQUIRED", "projectId is required.", 400);
        await recordReadAccess("/project-control-data", "accepted", { kind: backofficeAuth ? "backoffice-basic-auth" : "project-owner", id: backofficeAuth ? "backoffice-user" : "development-local" });
        return json(response, 200, { service: HERO_SERVICE, controlRoom: projectControlSnapshot(projectId) }, { maxBytes: backofficeResponseLimitBytes });
      }

      if (request.method === "GET" && url.pathname === "/workspace") {
        const projectId = url.searchParams.get("projectId");
        if (!projectId) return redirect(response, "/portfolio?select=project&next=workspace");
        await recordReadAccess("/workspace", "accepted", { kind: backofficeAuth ? "backoffice-basic-auth" : "project-owner", id: backofficeAuth ? "backoffice-user" : "development-local" });
        return html(response, getProjectWorkspaceHtml({ projectId }));
      }

      if (request.method === "GET" && url.pathname === "/walkthrough") {
        const projectId = url.searchParams.get("projectId");
        await recordReadAccess("/walkthrough", "accepted", { kind: backofficeAuth ? "backoffice-basic-auth" : "project-owner", id: backofficeAuth ? "backoffice-user" : "development-local" });
        return html(response, getProjectWalkthroughHtml({ projectId }));
      }

      if (request.method === "GET" && url.pathname === "/portfolio") {
        if (url.searchParams.get("surface") === "walkthrough") {
          const projectId = url.searchParams.get("projectId");
          await recordReadAccess("/walkthrough", "accepted", { kind: backofficeAuth ? "backoffice-basic-auth" : "project-owner", id: backofficeAuth ? "backoffice-user" : "development-local" });
          return html(response, getProjectWalkthroughHtml({ projectId }));
        }
        if (url.searchParams.get("surface") === "ai") {
          await recordReadAccess("/backoffice", "accepted", { kind: backofficeAuth ? "backoffice-basic-auth" : "project-owner", id: backofficeAuth ? "backoffice-user" : "development-local" });
          return html(response, getBackofficeHtml({ initialData: backofficeSnapshot(), active: "ai" }));
        }
        if (url.searchParams.get("surface") === "command") {
          const projectId = url.searchParams.get("projectId");
          if (!projectId) return redirect(response, "/portfolio?select=project&next=command");
          await recordReadAccess("/backoffice", "accepted", { kind: backofficeAuth ? "backoffice-basic-auth" : "project-owner", id: backofficeAuth ? "backoffice-user" : "development-local" });
          return html(response, getProjectControlRoomHtml({
            initialData: { service: HERO_SERVICE, controlRoom: projectControlSnapshot(projectId) },
            dataEndpoint: "/portfolio-data?surface=command",
            active: "backoffice",
            heading: "مرکز فرمان",
            environment: "Private · Command"
          }));
        }
        const destinationCandidate = url.searchParams.get("next") ?? url.searchParams.get("open");
        const destination = ["command", "studio", "workspace", "control", "walkthrough"].includes(destinationCandidate) ? destinationCandidate : null;
        const view = url.searchParams.get("view") === "archived" ? "archived" : "active";
        return html(response, getPortfolioHtml({ portfolio: portfolioSnapshot(null, { view }), destination, selectionRequired: url.searchParams.get("select") === "project" || Boolean(destination), archiveView: view === "archived" }));
      }

      if (request.method === "GET" && url.pathname === "/portfolio-data") {
        if (url.searchParams.get("surface") === "command") {
          const projectId = url.searchParams.get("projectId");
          if (!projectId) throw new ProjectWorkspaceError("PROJECT_SCOPE_REQUIRED", "A projectId is required for Command Center.", 400);
          await recordReadAccess("/backoffice-data", "accepted", { kind: backofficeAuth ? "backoffice-basic-auth" : "project-owner", id: backofficeAuth ? "backoffice-user" : "development-local" });
          return json(response, 200, { service: HERO_SERVICE, controlRoom: projectControlSnapshot(projectId) }, { maxBytes: backofficeResponseLimitBytes });
        }
        return json(response, 200, { service: HERO_SERVICE, portfolio: portfolioSnapshot(null, { view: url.searchParams.get("view") === "archived" ? "archived" : "active" }) }, { maxBytes: backofficeResponseLimitBytes });
      }

      const authenticatedOwner = url.pathname.startsWith("/api/") && !PUBLIC_IDENTITY_PATHS.has(url.pathname) && !PUBLIC_UI_ASSET_PATHS.has(url.pathname)
        ? authenticateApiPrincipal(request.headers.authorization, request.headers.cookie)
        : null;
      if (authenticatedOwner) {
        assertCookieMutationOrigin(request, authenticatedOwner);
        assertApiPermission(request, url, authenticatedOwner);
      }

      if (request.method === "GET" && url.pathname === "/api/identity/status") {
        return json(response, 200, { service: HERO_SERVICE, identity: identityStatusSnapshot() });
      }

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
        return json(response, 200, { service: HERO_SERVICE, session }, { headers: { "set-cookie": humanSessionCookie(session.token) } });
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

      if (url.pathname === "/api/ai/credentials" && request.method === "GET") {
        const snapshot = backofficeSnapshot();
        return json(response, 200, { service: HERO_SERVICE, credentials: snapshot.ai.credentials, mode: secretStore ? "embedded-test-encrypted" : "unavailable" });
      }

      if (url.pathname === "/api/ai/credentials" && request.method === "POST") {
        if (!humanIdentity?.configured || authenticatedOwner?.source !== "human-identity" || authenticatedOwner.role !== "project-owner") {
          throw new HumanIdentityError("IDENTITY_AUTH_REQUIRED", "Only the Human Identity Owner may register an AI credential.", 401);
        }
        humanIdentity.assertSensitiveActionAllowed({ principal: authenticatedOwner, action: "secret.write" });
        if (!secretStore) throw new HeroSecretStoreError("SECRET_STORE_NOT_CONFIGURED", "The Test Secret Store is not enabled in this runtime.", 503);
        const input = await readJson(request, 20 * 1024);
        const providerId = typeof input.providerId === "string" ? input.providerId.trim() : "";
        if (!AI_CREDENTIAL_PROVIDERS.includes(providerId)) throw new HeroSecretStoreError("SECRET_PROVIDER_INVALID", "این Provider برای ثبت Secret پشتیبانی نمی‌شود.", 400);
        const result = secretStore.set({ providerId, secretId: "default", value: input.value });
        // Audit metadata must prove the operation without retaining a secret
        // reference.  The identity audit store deliberately rejects any
        // credential/secret-shaped field name, including credentialRef.
        await persistIdentityAudit({ userId: authenticatedOwner.subject, eventType: "ai.credential-stored", data: { providerId, environment: result.environment, version: result.version, state: result.state } });
        return json(response, 201, { service: HERO_SERVICE, credential: Object.freeze({ ...result, secretValueExposed: false }) });
      }

      const aiCredentialHealthMatch = url.pathname.match(/^\/api\/ai\/credentials\/([a-z][a-z0-9-]{2,63})\/(?:status|health)$/);
      if (aiCredentialHealthMatch && ["GET", "POST"].includes(request.method)) {
        const providerId = aiCredentialHealthMatch[1];
        if (!AI_CREDENTIAL_PROVIDERS.includes(providerId)) throw new HeroSecretStoreError("SECRET_PROVIDER_INVALID", "Provider معتبر نیست.", 400);
        const credentialRef = `vault:hero/test/${providerId}/default`;
        if (request.method === "GET") {
          return json(response, 200, { service: HERO_SERVICE, credential: secretStore?.status({ credentialRef }) ?? Object.freeze({ credentialRef, providerId, environment: "test", configured: false, state: "secret-store-unavailable", version: null, updatedAt: null, secretValueExposed: false }) });
        }
        if (!secretStore) throw new HeroSecretStoreError("SECRET_STORE_NOT_CONFIGURED", "The Test Secret Store is not enabled in this runtime.", 503);
        const adapter = providerAdapters[providerId];
        if (!adapter?.validateConnection) throw new HeroSecretStoreError("PROVIDER_ADAPTER_NOT_CONFIGURED", "Provider adapter is not enabled in this runtime.", 503);
        try {
          const checked = await adapter.validateConnection({ credentialRef });
          await persistIdentityAudit({ userId: authenticatedOwner.subject, eventType: "ai.credential-health-checked", data: { providerId, status: "healthy", mode: checked.mode } });
          return json(response, 200, { service: HERO_SERVICE, credential: Object.freeze({ credentialRef, providerId, environment: "test", configured: true, state: "healthy", mode: checked.mode, secretValueExposed: false }) });
        } catch (error) {
          const status = secretStore.status({ credentialRef });
          await persistIdentityAudit({ userId: authenticatedOwner.subject, eventType: "ai.credential-health-checked", outcome: "rejected", data: { providerId, status: status.configured ? "blocked" : "not-configured", code: error?.code ?? "CREDENTIAL_HEALTH_FAILED" } });
          return json(response, 503, { service: HERO_SERVICE, credential: Object.freeze({ ...status, state: status.configured ? "blocked" : "not-configured", code: error?.code ?? "CREDENTIAL_HEALTH_FAILED", secretValueExposed: false }) });
        }
      }

      if (request.method === "GET" && ["/api/form-suggestions/options", "/api/advisor/options"].includes(url.pathname)) {
        const queryProjectId = url.searchParams.get("projectId");
        if (queryProjectId !== null && !/^[a-z][a-z0-9-]{2,62}$/.test(queryProjectId)) {
          throw new FormSuggestionsError("FORM_SUGGESTION_PROJECT_INVALID", "شناسهٔ پروژه برای پیشنهاد فرم معتبر نیست.", 400);
        }
        const advisorOptions = formSuggestionOptions(queryProjectId);
        return json(response, 200, { service: HERO_SERVICE, advisor: advisorOptions, formSuggestions: advisorOptions });
      }

      if (request.method === "GET" && url.pathname === "/api/project-intake-advisor/options") {
        const advisorOptions = formSuggestionOptions(null);
        return json(response, 200, {
          service: HERO_SERVICE,
          advisor: Object.freeze({
            ...advisorOptions,
            defaultAdvisorId: "local",
            preCreationLiveEligible: false,
            note: "پیش از ثبت پروژه، Advisor محلی پیشنهادهای قابل بازبینی می‌سازد. Provider زنده و هزینه‌دار تا پس از ثبت پروژه و گیت‌های جداگانه فعال نمی‌شود."
          })
        });
      }

      if (request.method === "POST" && ["/api/project-intake-advisor", "/api/project-intake-advisor/refine"].includes(url.pathname)) {
        if (!authenticatedOwner || !["human-identity", "admin"].includes(authenticatedOwner.source)) {
          throw new HumanIdentityError("IDENTITY_AUTH_REQUIRED", "برای پیشنهاد مرحلهٔ ایجاد پروژه ورود انسانی یا نشست Admin لازم است.", 401);
        }
        const input = await readJson(request, 16 * 1024);
        const selectedAdvisor = input.selectedAdvisor === undefined || input.selectedAdvisor === null || input.selectedAdvisor === "" ? "local" : input.selectedAdvisor;
        if (selectedAdvisor !== "local") {
          throw new ProjectIntakeAdvisorError("PROJECT_INTAKE_ADVISOR_LIVE_DEFERRED", "Provider زنده پیش از ثبت پروژه فعال نمی‌شود؛ ابتدا پیشنهاد محلی را بازبینی و پروژه را ثبت کنید.", 403);
        }
        const advisor = createProjectIntakeAdvisor({
          actor: authenticatedOwner,
          firstFive: input.firstFive,
          ...(url.pathname.endsWith("/refine") ? { feedback: input.feedback } : {})
        });
        return json(response, 200, { service: HERO_SERVICE, advisor });
      }

      if (request.method === "POST" && ["/api/form-suggestions", "/api/advisor"].includes(url.pathname)) {
        if (!authenticatedOwner || !["human-identity", "admin"].includes(authenticatedOwner.source)) {
          throw new HumanIdentityError("IDENTITY_AUTH_REQUIRED", "برای پیشنهاد فرم ورود انسانی یا نشست Admin لازم است.", 401);
        }
        const input = await readJson(request, 16 * 1024);
        const queryProjectId = url.searchParams.get("projectId");
        if (input.projectId !== undefined && (input.projectId ?? null) !== (queryProjectId ?? null)) {
          throw new FormSuggestionsError("FORM_SUGGESTION_SCOPE_MISMATCH", "Scope پروژهٔ پیشنهاد فرم معتبر نیست.", 400);
        }
        const projectId = queryProjectId || null;
        const options = formSuggestionOptions(projectId);
        const selectedAdvisor = input.selectedAdvisor === undefined || input.selectedAdvisor === null || input.selectedAdvisor === "" ? "local" : input.selectedAdvisor;
        if (selectedAdvisor !== "local" && !options.profiles.some(profile => profile.profileId === selectedAdvisor && profile.selectable === true && profile.dispatchReady === true)) {
          throw new FormSuggestionsError("FORM_SUGGESTION_ADVISOR_UNAVAILABLE", "AI انتخاب‌شده در فهرست سراسری موجود است، اما مجوز صریح سرویس سراسری Test یا Health اتصال هنوز برای اجرای زنده آماده نیست.", 403);
        }
        let authoritativeGoal = input.softwareGoal;
        if (projectId) authoritativeGoal = projectOverview(projectId).intake?.goal || authoritativeGoal;
        const formRequest = prepareFormSuggestionRequest({
          actor: authenticatedOwner,
          projectId,
          formId: input.formId,
          formTitle: input.formTitle,
          softwareGoal: authoritativeGoal,
          boxDescription: input.boxDescription,
          fields: input.fields,
          assets: input.assets,
          selectedAdvisor
        });
        if (selectedAdvisor === "local") {
          const formSuggestions = createFormSuggestions({ ...formRequest, actor: authenticatedOwner, selectedAdvisor: "local" });
          return json(response, 200, { service: HERO_SERVICE, advisor: formSuggestions, formSuggestions });
        }
        const selectedProfile = options.profiles.find(profile => profile.profileId === selectedAdvisor);
        const documentProposalEligible = formRequest.formId === "upload-form";
        const live = await invokeSelectedLiveAdvisor({
          purpose: "form-suggestions",
          projectId,
          selectedProfile,
          question: `ابتدا کاربرد واقعی همین باکس را از عنوان، توضیح زمینه، فیلدها و ورودی‌های سند/تصویر تحلیل کن. سپس در boxPurpose یک شرح فارسی روشن و مفصل بنویس و دقیقاً سه پیشنهاد قابل بازبینی تولید کن. برای هر گزینه، مقدارها باید از نظر سطح جزئیات یا رویکرد واقعاً متفاوت باشند، نه سه بازنویسی از یک متن. decisionSupport را با assumptions، risks، tests و improvements کوتاه و عملی تکمیل کن. اگر assets وجود دارد، برای هر مورد فقط یک assetProposal امن شامل name، title، filename، brief، altText و acceptanceCriteria بده؛ فایل باینری، URL یا ادعای بارگذاری تولید نکن. فقط JSON معتبر با schema form-suggestions-v1 برگردان؛ برای هر پیشنهاد دقیقاً یک entry برای هر field و فقط مقدارهای مجاز همان field بده.${documentProposalEligible ? " چون این فرم ورودی اختیاری متن پروژه است، اگر یک پیش‌نویس کوتاه واقعاً مفید است، یک documentProposal قابل‌خواندن هم برگردان؛ پیش‌نویس را هرگز ثبت‌شده یا بارگذاری‌شده معرفی نکن." : ""}`,
          context: { pathname: "/form-suggestions", featureKey: "form.suggestions", formSuggestion: { ...formRequest, requestedSuggestionCount: FORM_SUGGESTION_INITIAL_SUGGESTIONS, documentProposalEligible } },
          localResponse: `Generate ${FORM_PROVIDER_SUGGESTIONS_SCHEMA} with boxPurpose, materially distinct suggestions, decisionSupport, and optional review-only assetProposals${documentProposalEligible ? ", and an optional review-only documentProposal" : ""}; no prose outside JSON, secrets, paths, tools, binary data, or executable actions.`
        });
        let providerOutput;
        try {
          providerOutput = JSON.parse(live.response);
        } catch {
          throw new FormSuggestionsError("FORM_SUGGESTION_PROVIDER_OUTPUT_INVALID", "Provider پاسخ JSON معتبر برای پیشنهاد فرم برنگرداند.", 502);
        }
        const formSuggestions = createProviderFormSuggestions({ ...formRequest, actor: authenticatedOwner, selectedAdvisor, providerOutput, requestedSuggestionCount: FORM_SUGGESTION_INITIAL_SUGGESTIONS });
        return json(response, 200, {
          service: HERO_SERVICE,
          advisor: formSuggestions,
          formSuggestions,
          providerInvocation: Object.freeze({ invocationId: live.invocationId, providerInvoked: true, costUnits: live.costUnits, status: "completed" }),
          evidence: live.evidence
        });
      }

      if (request.method === "POST" && ["/api/form-suggestions/refine", "/api/advisor/refine"].includes(url.pathname)) {
        if (!authenticatedOwner || !["human-identity", "admin"].includes(authenticatedOwner.source)) {
          throw new HumanIdentityError("IDENTITY_AUTH_REQUIRED", "برای اصلاح تعاملی پیشنهاد فرم ورود انسانی یا نشست Admin لازم است.", 401);
        }
        const input = await readJson(request, 24 * 1024);
        const queryProjectId = url.searchParams.get("projectId");
        if (input.projectId !== undefined && (input.projectId ?? null) !== (queryProjectId ?? null)) {
          throw new FormSuggestionsError("FORM_SUGGESTION_SCOPE_MISMATCH", "Scope پروژهٔ اصلاح پیشنهاد فرم معتبر نیست.", 400);
        }
        const projectId = queryProjectId || null;
        const options = formSuggestionOptions(projectId);
        const selectedAdvisor = input.selectedAdvisor;
        if (!options.profiles.some(profile => profile.profileId === selectedAdvisor && profile.selectable === true && profile.dispatchReady === true)) {
          throw new FormSuggestionsError("FORM_SUGGESTION_ADVISOR_UNAVAILABLE", "AI انتخاب‌شده در فهرست سراسری موجود است، اما مجوز صریح سرویس سراسری Test یا Health اتصال هنوز برای اجرای زنده آماده نیست.", 403);
        }
        let authoritativeGoal = input.softwareGoal;
        if (projectId) authoritativeGoal = projectOverview(projectId).intake?.goal || authoritativeGoal;
        const refinement = prepareFormSuggestionRefinement({
          actor: authenticatedOwner,
          projectId,
          formId: input.formId,
          formTitle: input.formTitle,
          softwareGoal: authoritativeGoal,
          boxDescription: input.boxDescription,
          fields: input.fields,
          assets: input.assets,
          selectedAdvisor,
          feedback: input.feedback,
          iteration: input.iteration
        });
        const selectedProfile = options.profiles.find(profile => profile.profileId === selectedAdvisor);
        const formRequest = prepareFormSuggestionRequest({
          actor: authenticatedOwner,
          projectId,
          formId: refinement.formId,
          formTitle: refinement.formTitle,
          softwareGoal: refinement.softwareGoal,
          boxDescription: refinement.boxDescription,
          fields: refinement.fields,
          assets: refinement.assets,
          selectedAdvisor
        });
        const documentProposalEligible = formRequest.formId === "upload-form";
        const fieldDirectiveInstruction = refinement.fieldDirectives.length > 0
          ? `دستورهای صریح و field-aware که باید دقیقاً رعایت شوند: ${refinement.fieldDirectives.map(directive => `فیلد شمارهٔ ${directive.fieldPosition} با نام «${directive.fieldName}» و برچسب «${directive.fieldLabel}» باید ${directive.mode === "compact" ? "یک توضیح کوتاه و روشن، حداکثر ۲۲۰ نویسه" : "توضیحی مفصل، دست‌کم ۲۲۰ نویسه و شامل جزئیات مرتبط با همان فیلد"} داشته باشد`).join("؛ ")}. این دستورها فقط برای همان فیلدها هستند؛ مقدار یا ساختار فیلدهای دیگر را بی‌دلیل تغییر نده و در feedbackResponse نام همین فیلدها و تغییر اعمال‌شده را روشن بگو.`
          : "اگر بازخورد به یک فیلد اشاره کرده است، نام، برچسب و نوع همان فیلد را از فهرست فرم تشخیص بده و تغییر را فقط روی همان فیلد اعمال کن.";
        const live = await invokeSelectedLiveAdvisor({
          purpose: "form-suggestions",
          projectId,
          selectedProfile,
          question: `ادمین پس از دیدن پیشنهادهای قبلی این بازخورد را داده است: «${refinement.feedback}». بازخورد را فقط برای بهترکردن پیشنهادهای همین باکس اعمال کن. ${fieldDirectiveInstruction} ابتدا کاربرد واقعی باکس را دوباره بررسی کن و سپس در boxPurpose شرح فارسی روشن و مفصل، feedbackResponse در ۱ تا ۳ جملهٔ کوتاه دربارهٔ تفسیر بازخورد و تغییر ایجادشده، decisionSupport بازنگری‌شده، و دقیقاً یک پیشنهاد جدید و قابل انتخاب برگردان. اگر بازخورد به سند یا تصویر مربوط است، assetProposals را نیز متناسب بازنگری کن. مقدارهای پیشنهاد تازه باید به‌طور محسوس بر اساس بازخورد تغییر کرده باشند؛ از پاسخ قالبی یا تکرار متن عمومی استفاده نکن. فقط JSON معتبر با schema form-suggestions-v1 برگردان؛ برای همان پیشنهاد دقیقاً یک entry برای هر field و فقط مقدارهای مجاز همان field بده.${documentProposalEligible ? " اگر پیش‌نویس سند اختیاری مفید است، documentProposal تازه را هم بازنگری کن؛ هرگز آن را ذخیره‌شده یا بارگذاری‌شده معرفی نکن." : ""}`,
          // Feedback remains transient in the request, not in the structured
          // form context or the redacted event evidence.
          context: { pathname: "/form-suggestions", featureKey: "form.suggestions.refine", formSuggestion: { ...formRequest, requestedSuggestionCount: 1, refinement: true, documentProposalEligible } },
          localResponse: `Generate ${FORM_PROVIDER_SUGGESTIONS_SCHEMA} with boxPurpose, feedbackResponse and one feedback-driven revised suggestion${documentProposalEligible ? ", plus an optional review-only revised documentProposal" : ""}; no prose outside JSON, secrets, paths, tools, or executable actions.`
        });
        let providerOutput;
        try {
          providerOutput = JSON.parse(live.response);
        } catch {
          throw new FormSuggestionsError("FORM_SUGGESTION_PROVIDER_OUTPUT_INVALID", "Provider پاسخ JSON معتبر برای اصلاح پیشنهاد فرم برنگرداند.", 502);
        }
        // `feedback` and its field-aware derivative are only used here to
        // keep a safe deterministic fallback responsive if a structurally
        // incomplete Provider reply omits a value or ignores an explicit
        // concise/detailed field request. They are not added to the structured
        // Provider context, event, audit record or returned as standalone data.
        const suggestions = createProviderFormSuggestions({ ...formRequest, actor: authenticatedOwner, selectedAdvisor, providerOutput, requestedSuggestionCount: 1, suggestionOffset: FORM_SUGGESTION_INITIAL_SUGGESTIONS + refinement.iteration - 1, feedback: refinement.feedback, feedbackDirectives: refinement.fieldDirectives });
        const formSuggestions = Object.freeze({
          ...suggestions,
          refinement: Object.freeze({ iteration: refinement.iteration, feedbackAcknowledged: true })
        });
        return json(response, 200, {
          service: HERO_SERVICE,
          advisor: formSuggestions,
          formSuggestions,
          providerInvocation: Object.freeze({ invocationId: live.invocationId, providerInvoked: true, costUnits: live.costUnits, status: "completed" }),
          evidence: live.evidence
        });
      }

      if (request.method === "POST" && url.pathname === "/api/walkthrough/advice") {
        if (!humanIdentity?.configured || authenticatedOwner?.source !== "human-identity") {
          throw new HumanIdentityError("IDENTITY_AUTH_REQUIRED", "Human authentication is required.", 401);
        }
        const input = await readJson(request, 4 * 1024);
        const queryProjectId = url.searchParams.get("projectId");
        if (input.projectId !== undefined && input.projectId !== queryProjectId) {
          throw new ProjectWorkspaceError("WALKTHROUGH_ADVICE_SCOPE_MISMATCH", "Project scope for Walk-Through advice is invalid.", 400);
        }
        try {
          const profileId = input.advisorProfileId === undefined || input.advisorProfileId === null || input.advisorProfileId === "local" ? null : input.advisorProfileId;
          if (profileId !== null && (typeof profileId !== "string" || !/^[A-Za-z][A-Za-z0-9._:-]{2,127}$/.test(profileId))) {
            throw new ProjectWorkspaceError("WALKTHROUGH_ADVISOR_PROFILE_INVALID", "Walk-Through advisor profile is invalid.", 400);
          }
          const options = queryProjectId ? walkthroughAdvisorOptions(queryProjectId) : null;
          const selectedProfile = profileId ? options?.profiles.find(profile => profile.profileId === profileId) : null;
          if (profileId && (!selectedProfile || selectedProfile.selectable !== true || selectedProfile.dispatchReady !== true)) {
            throw new ProjectWorkspaceError("WALKTHROUGH_ADVISOR_PROFILE_UNAVAILABLE", "AI انتخاب‌شده سراسری است، اما مجوز صریح سرویس سراسری Test یا Health اتصال برای اجرای زندهٔ Walk-Through آماده نیست.", 400);
          }
          const advisor = createProjectWalkthroughAdvisory({
            stepId: input.stepId,
            projectId: queryProjectId,
            question: input.question
          });
          const progress = createProjectWalkthroughProgress({
            authenticated: true,
            projectId: queryProjectId,
            // A Project Grant can exist before the Workspace read model is
            // populated. Guidance must remain available in that transitional
            // state and simply report the setup steps as incomplete.
            overview: queryProjectId ? (() => {
              try { return projectOverview(queryProjectId); } catch { return null; }
            })() : null
          });
          const live = selectedProfile
            ? await invokeSelectedLiveAdvisor({
              purpose: "walkthrough-guide",
              projectId: queryProjectId,
              selectedProfile,
              question: input.question,
              context: {
                stepId: input.stepId,
                progress: progress.summary,
                step: progress.steps.find(item => item.stepId === input.stepId) ?? null
              },
              localResponse: advisor.response
            })
            : null;
          // Questions and answers are not stored in the Walk-Through record.
          // The AI orchestration ledger retains only redacted invocation and
          // usage metadata when a separately authorized live profile is used.
          return json(response, 200, {
            service: HERO_SERVICE,
            advisor: Object.freeze({
              ...advisor,
              progress,
              ...(live ? {
                mode: "live-project-advisor",
                providerInvoked: true,
                response: live.response,
                result: live.result,
                evidence: live.evidence,
                invocation: Object.freeze({ invocationId: live.invocationId, costUnits: live.costUnits, status: live.evidence.status, latencyMs: live.evidence.latencyMs, usage: live.evidence.usage })
              } : {}),
              selectedAdvisor: selectedProfile
                ? Object.freeze({ kind: "profile", profileId: selectedProfile.profileId, providerId: selectedProfile.providerId, modelId: selectedProfile.modelId, profileVersion: selectedProfile.profileVersion, dispatch: live ? "live-response" : "local-response" })
                : Object.freeze({ kind: "local", dispatch: "local-response" })
            })
          });
        } catch (error) {
          if (error instanceof RangeError || error instanceof TypeError) {
            throw new ProjectWorkspaceError("WALKTHROUGH_ADVICE_INVALID", "Walk-Through advice request is invalid.", 400);
          }
          throw error;
        }
      }

      if (url.pathname.startsWith("/api/smart-tester/")) {
        if (!humanIdentity?.configured || authenticatedOwner?.source !== "human-identity" || authenticatedOwner.role !== "project-owner") {
          throw new HumanIdentityError("IDENTITY_AUTH_REQUIRED", "A Hero owner human session is required for Smart Tester.", 401);
        }
        const queryProjectId = url.searchParams.get("projectId");
        const projectIdPattern = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;
        if (queryProjectId !== null && !projectIdPattern.test(queryProjectId)) {
          throw new ProjectWorkspaceError("SMART_TESTER_PROJECT_INVALID", "Smart Tester project scope is invalid.", 400);
        }
        if (request.method === "GET" && url.pathname === "/api/smart-tester/options") {
          return json(response, 200, { service: HERO_SERVICE, smartTester: Object.freeze({ version: HERO_SMART_TESTER_VERSION, options: smartTesterAdvisorOptions(queryProjectId) }) });
        }
        if (request.method === "GET" && url.pathname === "/api/smart-tester/errors/document") {
          if (!queryProjectId) throw new ProjectWorkspaceError("SMART_TESTER_PROJECT_REQUIRED", "برای مشاهدهٔ دفتر خطا، یک پروژه را انتخاب کنید.", 400);
          return json(response, 200, { service: HERO_SERVICE, smartTester: Object.freeze({ document: await readSmartTesterErrorDocument({ projectId: queryProjectId }) }) });
        }
        const contextInput = {
          pathname: url.searchParams.get("surface"),
          featureKey: url.searchParams.get("featureKey"),
          projectId: queryProjectId,
          boxId: url.searchParams.get("boxId"),
          boxTitle: url.searchParams.get("boxTitle"),
          boxDescription: url.searchParams.get("boxDescription")
        };
        let context;
        try {
          context = resolveSmartTesterContext(contextInput);
        } catch {
          throw new ProjectWorkspaceError("SMART_TESTER_CONTEXT_INVALID", "Smart Tester context is invalid or not allowed.", 400);
        }
        let contextualSmartTesterContext;
        try {
          contextualSmartTesterContext = Object.freeze({ ...context, projectSummary: smartTesterProjectSummary(context) });
        } catch (error) {
          throw new ProjectWorkspaceError("SMART_TESTER_CONTEXT_UNAVAILABLE", `Smart Tester context could not be read: ${error?.code ?? "UNKNOWN_ERROR"}.`, 404);
        }
        if (request.method === "GET" && url.pathname === "/api/smart-tester/context") {
          return json(response, 200, {
            service: HERO_SERVICE,
            smartTester: Object.freeze({
              version: HERO_SMART_TESTER_VERSION,
              enabledScope: "browser-local",
              advisor: Object.freeze({ id: "hero-local-smart-tester", mode: "local-contextual-development-assistant", providerInvoked: false }),
              context: contextualSmartTesterContext
            })
          });
        }
        if (request.method === "POST" && url.pathname === "/api/smart-tester/run") {
          const input = await readJson(request, 2 * 1024);
          if ((input.projectId ?? null) !== (queryProjectId ?? null) || (input.surface ?? null) !== context.pathname || (input.featureKey ?? null) !== context.featureKey || (input.boxId !== undefined && input.boxId !== context.boxId)) {
            throw new ProjectWorkspaceError("SMART_TESTER_SCOPE_MISMATCH", "Smart Tester request scope is invalid.", 400);
          }
          const probe = smartTesterProbe(contextualSmartTesterContext, authenticatedOwner);
          const report = createSmartTesterReport({ context: contextualSmartTesterContext, ...probe });
          const reportId = storeSmartTesterReport({ principal: authenticatedOwner, report });
          return json(response, 200, { service: HERO_SERVICE, smartTester: Object.freeze({ reportId, expiresInSeconds: Math.floor(HERO_SMART_TESTER_REPORT_TTL_MS / 1000), report }) });
        }
        if (request.method === "POST" && url.pathname === "/api/smart-tester/advice") {
          const input = await readJson(request, 4 * 1024);
          if ((input.projectId ?? null) !== (queryProjectId ?? null) || (input.surface ?? null) !== context.pathname || (input.featureKey ?? null) !== context.featureKey || (input.boxId !== undefined && input.boxId !== context.boxId)) {
            throw new ProjectWorkspaceError("SMART_TESTER_SCOPE_MISMATCH", "Smart Tester request scope is invalid.", 400);
          }
          try {
            const report = readSmartTesterReport({ principal: authenticatedOwner, reportId: input.reportId, context: contextualSmartTesterContext });
            let selectedAdvisor = null;
            if (input.advisorProfileId !== undefined && input.advisorProfileId !== null && input.advisorProfileId !== "" && input.advisorProfileId !== "local") {
              const options = smartTesterAdvisorOptions(contextualSmartTesterContext.projectId);
              const profile = options.profiles.find(item => item.profileId === input.advisorProfileId);
              if (!profile || profile.selectable !== true || profile.dispatchReady !== true) throw new ProjectWorkspaceError("SMART_TESTER_ADVISOR_UNAVAILABLE", "AI انتخاب‌شده سراسری است، اما مجوز صریح سرویس سراسری Test یا Health اتصال برای اجرای زندهٔ Smart Tester آماده نیست.", 400);
              selectedAdvisor = profile;
            }
            const advisor = createSmartTesterAdvisory({ context: contextualSmartTesterContext, question: input.question, report, selectedAdvisor, actionFailure: input.actionFailure });
            const live = selectedAdvisor && contextualSmartTesterContext.projectId
              ? await invokeSelectedLiveAdvisor({ purpose: "smart-tester", projectId: contextualSmartTesterContext.projectId, selectedProfile: selectedAdvisor, question: input.question, context: contextualSmartTesterContext, localResponse: advisor.response })
              : null;
            // Questions and answers are not persisted; a live invocation keeps
            // only redacted metadata and metered usage in the AI ledger.
            const renderedAdvisor = live
              ? Object.freeze({ ...advisor, mode: "live-contextual-development-assistant", providerInvoked: true, response: live.response, result: live.result, evidence: live.evidence, invocation: Object.freeze({ invocationId: live.invocationId, costUnits: live.costUnits, status: live.evidence.status, latencyMs: live.evidence.latencyMs, usage: live.evidence.usage }), selectedAdvisor: Object.freeze({ ...advisor.selectedAdvisor, providerInvoked: true }) })
              : advisor;
            return json(response, 200, { service: HERO_SERVICE, smartTester: Object.freeze({ advisor: renderedAdvisor }) });
          } catch (error) {
            if (error instanceof RangeError || error instanceof TypeError) {
              throw new ProjectWorkspaceError("SMART_TESTER_ADVICE_INVALID", "Smart Tester advice request is invalid.", 400);
            }
            throw error;
          }
        }
        if (request.method === "POST" && url.pathname === "/api/smart-tester/diagnose") {
          const input = await readJson(request, 4 * 1024);
          if ((input.projectId ?? null) !== (queryProjectId ?? null) || (input.surface ?? null) !== context.pathname || (input.featureKey ?? null) !== context.featureKey || (input.boxId !== undefined && input.boxId !== context.boxId)) {
            throw new ProjectWorkspaceError("SMART_TESTER_SCOPE_MISMATCH", "Smart Tester request scope is invalid.", 400);
          }
          if (input.reportId) readSmartTesterReport({ principal: authenticatedOwner, reportId: input.reportId, context: contextualSmartTesterContext });
          const probe = smartTesterProbe(contextualSmartTesterContext, authenticatedOwner);
          const errorReport = createSmartTesterErrorReport({ context: contextualSmartTesterContext, ...probe, chatInformed: input.chatInformed === true, actionFailure: input.actionFailure });
          const errorReportId = storeSmartTesterErrorReport({ principal: authenticatedOwner, report: errorReport });
          return json(response, 200, { service: HERO_SERVICE, smartTester: Object.freeze({ errorReportId, expiresInSeconds: Math.floor(HERO_SMART_TESTER_REPORT_TTL_MS / 1000), errorReport }) });
        }
        if (request.method === "POST" && url.pathname === "/api/smart-tester/errors/submit") {
          const input = await readJson(request, 8 * 1024);
          if (!queryProjectId || (input.projectId ?? null) !== queryProjectId || (input.surface ?? null) !== context.pathname || (input.featureKey ?? null) !== context.featureKey || (input.boxId !== undefined && input.boxId !== context.boxId)) {
            throw new ProjectWorkspaceError("SMART_TESTER_SCOPE_MISMATCH", "ثبت گزارش باید به همان پروژه و زمینهٔ خطایابی محدود باشد.", 400);
          }
          const errorReport = readSmartTesterErrorReport({ principal: authenticatedOwner, reportId: input.errorReportId, context: contextualSmartTesterContext });
          if (errorReport.context.projectId !== queryProjectId) throw new ProjectWorkspaceError("SMART_TESTER_PROJECT_MISMATCH", "گزارش خطا متعلق به این پروژه نیست.", 400);
          const document = await appendSmartTesterErrorDocument({ principal: authenticatedOwner, report: errorReport });
          return json(response, 201, { service: HERO_SERVICE, smartTester: Object.freeze({ document, errorReportId: input.errorReportId, errorReportVersion: HERO_SMART_TESTER_ERROR_REPORT_VERSION }) });
        }
      }

      if (request.method === "POST" && url.pathname === "/api/identity/step-up") {
        if (!humanIdentity?.configured || !authenticatedOwner?.source) throw new HumanIdentityError("IDENTITY_AUTH_REQUIRED", "Human authentication is required.", 401);
        const input = await readJson(request);
        const session = humanIdentity.stepUp({ principal: authenticatedOwner, mfaCode: input.mfaCode });
        await persistIdentityAudit({ userId: authenticatedOwner.subject, eventType: "identity.step-up-verified", data: { sessionId: session.principal.sessionId } });
        return json(response, 200, { service: HERO_SERVICE, session }, { headers: { "set-cookie": humanSessionCookie(session.token) } });
      }

      if (request.method === "POST" && url.pathname === "/api/identity/sessions/revoke") {
        if (!humanIdentity?.configured || !authenticatedOwner?.source) throw new HumanIdentityError("IDENTITY_AUTH_REQUIRED", "Human authentication is required.", 401);
        const input = await readJson(request);
        const revocation = humanIdentity.revokeSession({ actor: authenticatedOwner, sessionId: input.sessionId, reason: input.reason });
        if (postgresRuntime?.projectIdentity?.revokeSession) await postgresRuntime.projectIdentity.revokeSession({ sessionId: revocation.sessionId, userId: authenticatedOwner.subject, reason: revocation.reason });
        await persistIdentityAudit({ userId: authenticatedOwner.subject, eventType: "identity.session-revoked", data: { sessionId: revocation.sessionId, reason: revocation.reason } });
        return json(response, 200, { service: HERO_SERVICE, revocation }, { headers: { "set-cookie": clearHumanSessionCookie() } });
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
        return json(response, 200, { service: HERO_SERVICE, portfolio: portfolioSnapshot(authenticatedOwner, { view: url.searchParams.get("view") === "archived" ? "archived" : "active" }) });
      }

      if (request.method === "GET" && url.pathname === "/api/portfolio/search") {
        return json(response, 200, { service: HERO_SERVICE, query: url.searchParams.get("q") ?? "", results: searchPortfolio({ principal: authenticatedOwner, query: url.searchParams.get("q") ?? "" }) });
      }

      if (request.method === "POST" && url.pathname === "/api/projects") {
        const input = await readJson(request);
        const created = projectWorkspace.createProject({ actor: authenticatedOwner, projectId: input.projectId, name: input.name, description: input.description, intake: input.intake, idempotencyKey: input.idempotencyKey ?? request.headers["idempotency-key"] ?? undefined });
        await persistWorkspaceProjectAndProposal(created.project, created.foundationProposal, "Project created");
        return json(response, created.replayed ? 200 : 201, { service: HERO_SERVICE, ...created });
      }

      if (request.method === "POST" && url.pathname === "/api/project-clones") {
        if (authenticatedOwner?.role !== "project-owner") throw new ProjectWorkspaceError("OWNER_REQUIRED", "Only the owner may clone a project template.", 403);
        const input = await readJson(request);
        const cloned = projectWorkspace.cloneFromTemplate({ actor: authenticatedOwner, sourceProjectId: input.sourceProjectId, projectId: input.projectId, name: input.name, description: input.description });
        await persistWorkspaceProjectAndProposal(cloned.project, cloned.foundationProposal, `Cloned from ${input.sourceProjectId}`);
        return json(response, 201, { service: HERO_SERVICE, ...cloned });
      }

      const projectArchiveMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})\/archive$/);
      if (projectArchiveMatch && request.method === "POST") {
        const input = await readJson(request);
        const project = projectWorkspace.archiveProject({ actor: authenticatedOwner, projectId: projectArchiveMatch[1], expectedVersion: input.expectedVersion, reason: input.reason });
        await persistWorkspaceProject(project, input.reason);
        return json(response, 200, { service: HERO_SERVICE, project });
      }

      const projectRestoreMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})\/restore$/);
      if (projectRestoreMatch && request.method === "POST") {
        const input = await readJson(request);
        const project = projectWorkspace.restoreProject({ actor: authenticatedOwner, projectId: projectRestoreMatch[1], expectedVersion: input.expectedVersion });
        await persistWorkspaceProject(project, "Project restored");
        return json(response, 200, { service: HERO_SERVICE, project });
      }

      const projectPurgeMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})$/);
      if (projectPurgeMatch && request.method === "DELETE") {
        const input = await readJson(request);
        const prepared = projectWorkspace.preparePurge({ actor: authenticatedOwner, projectId: projectPurgeMatch[1], expectedVersion: input.expectedVersion, confirmationProjectId: input.confirmationProjectId, reason: input.reason });
        // Persist the minimal tombstone before removing any private bytes. If a
        // later cleanup fails, the project still cannot be revived on restart.
        await persistWorkspacePurge(prepared);
        let purge;
        try {
          purge = projectWorkspace.purgeProject({ actor: authenticatedOwner, projectId: projectPurgeMatch[1], expectedVersion: input.expectedVersion, confirmationProjectId: input.confirmationProjectId, reason: input.reason });
        } catch (error) {
          projectWorkspace.hydratePurgeTombstone?.({ projectId: prepared.projectId });
          projectSettings.purgeProject?.({ projectId: prepared.projectId });
          throw error;
        }
        projectSettings.purgeProject?.({ projectId: purge.projectId });
        const revokedGrants = projectAccessRegistry?.revokeProjectGrants?.({ actor: authenticatedOwner, projectId: purge.projectId }) ?? [];
        for (const grant of revokedGrants) {
          if (postgresRuntime?.projectIdentity?.appendGrant) await postgresRuntime.projectIdentity.appendGrant({ projectId: grant.projectId, userId: grant.userId, role: grant.role, status: "revoked", grantedBy: authenticatedOwner.subject });
          await persistIdentityAudit({ userId: grant.userId, eventType: "identity.project-grant-revoked", data: { projectId: grant.projectId, revokedBy: authenticatedOwner.subject, reason: "project-purged" } });
        }
        return json(response, 200, { service: HERO_SERVICE, purge, revokedGrantCount: revokedGrants.length });
      }

      const projectDeletionMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})\/deletion-request$/);
      if (projectDeletionMatch && request.method === "POST") {
        throw new ProjectWorkspaceError("PROJECT_PURGE_CONFIRMATION_REQUIRED", "Use DELETE /api/projects/:projectId after archiving and confirming the exact project identifier.", 400);
      }

      const projectReturnToDraftMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})\/return-to-draft$/);
      if (projectReturnToDraftMatch && request.method === "POST") {
        const input = await readJson(request);
        const result = projectWorkspace.returnToDraft({ actor: authenticatedOwner, projectId: projectReturnToDraftMatch[1], expectedVersion: input.expectedVersion, reason: input.reason });
        await persistWorkspaceProject(result.project, result.project.returnToDraftReason);
        await persistWorkspaceProposal(result.foundationProposal);
        return json(response, 200, { service: HERO_SERVICE, ...result });
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

      const projectTextInputRecallMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})\/inputs\/([A-Za-z][A-Za-z0-9._:-]{2,127})\/recall$/);
      if (projectTextInputRecallMatch && request.method === "GET") {
        const input = projectWorkspace.recallTextInput({ actor: authenticatedOwner, projectId: projectTextInputRecallMatch[1], uploadId: projectTextInputRecallMatch[2] });
        // A recalled text input is bounded to 512 KiB at upload time, but JSON
        // escaping can expand its representation. Keep the response cap above
        // that worst-case encoding while still preventing an unbounded read.
        return json(response, 200, { service: HERO_SERVICE, input }, { maxBytes: 4 * 1024 * 1024 });
      }

      const projectInputDownloadMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})\/inputs\/([A-Za-z][A-Za-z0-9._:-]{2,127})\/download$/);
      if (projectInputDownloadMatch && request.method === "GET") {
        const input = projectWorkspace.downloadInput({ actor: authenticatedOwner, projectId: projectInputDownloadMatch[1], uploadId: projectInputDownloadMatch[2] });
        // Downloads are always attachments. Never trust an uploaded MIME type
        // for browser rendering, and keep the private response out of caches.
        const filename = typeof input.filename === "string" && input.filename.trim() ? input.filename.trim() : "project-input";
        const encodedFilename = encodeURIComponent(filename).replaceAll("'", "%27").replaceAll("(", "%28").replaceAll(")", "%29").replaceAll("*", "%2A");
        response.writeHead(200, {
          "content-type": "application/octet-stream",
          "content-length": input.bytes.length,
          "content-disposition": `attachment; filename="project-input"; filename*=UTF-8''${encodedFilename}`,
          "cache-control": "no-store",
          "x-robots-tag": PRIVATE_ROBOTS_POLICY,
          "x-content-type-options": "nosniff",
          "referrer-policy": "no-referrer"
        });
        response.end(input.bytes);
        return;
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
        const proposal = projectWorkspace.approveFoundation({ actor: authenticatedOwner, projectId: projectFoundationApproveMatch[1], proposalId: input.proposalId, expectedVersion: input.expectedVersion, riskApproval: input.riskApproval === true });
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
      const walkthroughAdvisorOptionsMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})\/walkthrough-advisor\/options$/);
      if (walkthroughAdvisorOptionsMatch && request.method === "GET") {
        return json(response, 200, { service: HERO_SERVICE, advisorOptions: walkthroughAdvisorOptions(walkthroughAdvisorOptionsMatch[1]) });
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

      const projectCompletionMatch = url.pathname.match(/^\/api\/projects\/([a-z][a-z0-9-]{2,62})\/completion$/);
      if (projectCompletionMatch && request.method === "GET") {
        const projectId = projectCompletionMatch[1];
        return json(response, 200, {
          service: HERO_SERVICE,
          completion: {
            shell: backofficeCompletion.shell({ actor: authenticatedOwner, projectId }),
            capabilities: backofficeCompletion.capabilities({ actor: authenticatedOwner, projectId }),
            readiness: backofficeCompletion.readiness({ actor: authenticatedOwner, projectId })
          }
        }, { maxBytes: backofficeResponseLimitBytes });
      }
      if (projectCompletionMatch && request.method === "POST") {
        const input = await readJson(request);
        const projectId = projectCompletionMatch[1];
        let result;
        switch (input.action) {
          case "setting": result = backofficeCompletion.setSetting({ actor: authenticatedOwner, projectId, ...input }); break;
          case "trace": result = backofficeCompletion.recordTrace({ actor: authenticatedOwner, projectId, ...input }); break;
          case "evidence": result = backofficeCompletion.recordEvidence({ actor: authenticatedOwner, projectId, ...input }); break;
          case "retention": result = backofficeCompletion.setRetention({ actor: authenticatedOwner, projectId, ...input }); break;
          case "cleanup-preview": result = backofficeCompletion.cleanupPreview({ actor: authenticatedOwner, projectId, ...input }); break;
          case "locale": result = backofficeCompletion.setLocale({ actor: authenticatedOwner, projectId, locale: input.locale }); break;
          default: throw new BackofficeCompletionError("COMPLETION_ACTION_INVALID", "Completion action is invalid.", 400);
        }
        return json(response, 200, { service: HERO_SERVICE, result }, { maxBytes: backofficeResponseLimitBytes });
      }

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
      if (projectInfrastructureMatch && request.method === "POST") { const input = await readJson(request); const projectId = projectInfrastructureMatch[1]; const actions = { "register-repository": () => infrastructureControl.registerRepository({ actor: authenticatedOwner, projectId, ...input }), "onboard-server": () => infrastructureControl.onboardServer({ actor: authenticatedOwner, projectId, ...input }), "select-target": () => infrastructureControl.selectTarget({ actor: authenticatedOwner, projectId, ...input }), "connectivity-plan": () => infrastructureControl.connectivityPlan({ actor: authenticatedOwner, projectId, ...input }), "create-enrollment": () => infrastructureControl.createEnrollment({ actor: authenticatedOwner, projectId, ...input }), "rotate-node": () => infrastructureControl.rotateNodeIdentity({ actor: authenticatedOwner, projectId, ...input }), "revoke-node": () => infrastructureControl.revokeNode({ actor: authenticatedOwner, projectId, ...input }), "set-state": () => infrastructureControl.setState({ actor: authenticatedOwner, projectId, ...input }), "reconcile": () => infrastructureControl.reconcile({ actor: authenticatedOwner, projectId, ...input }), "register-secret-metadata": () => infrastructureControl.registerSecret({ actor: authenticatedOwner, projectId, ...input }), "request-secret-reveal": () => infrastructureControl.requestReveal({ actor: authenticatedOwner, projectId, ...input }), "set-egress-policy": () => infrastructureControl.setEgressPolicy({ actor: authenticatedOwner, projectId, ...input }) }; if (!actions[input.action]) throw new InfrastructureError("INFRASTRUCTURE_ACTION_INVALID", "Infrastructure action is invalid.", 400); return json(response, 201, { service: HERO_SERVICE, result: actions[input.action]() }); }

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
        return json(response, 200, { service: HERO_SERVICE, productDevelopmentContract: getProductDevelopmentContractSummary(), productFactoryContract: getProductFactoryContractSummary() });
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

      if (request.method === "POST" && url.pathname === "/api/ai/assignment-proposals") {
        const input = await readJson(request);
        const scopedProjectId = url.searchParams.get("projectId");
        if (input.projectId !== undefined && input.projectId !== scopedProjectId) {
          throw new DashboardCommandError("AI_ASSIGNMENT_PROJECT_SCOPE_MISMATCH", "محدودهٔ پروژه در درخواست یکسان نیست.", 400);
        }
        const projectId = scopedProjectId ?? input.projectId;
        if (typeof projectId !== "string" || !/^[A-Za-z][A-Za-z0-9._:-]{2,127}$/.test(projectId)) {
          throw new DashboardCommandError("PROJECT_SCOPE_REQUIRED", "پروژهٔ معتبر برای پیشنهاد تخصیص لازم است.", 400);
        }
        const proposal = assignmentProposalSnapshot(projectId, input.advisorProfileId ?? null);
        return json(response, 200, { service: HERO_SERVICE, proposal }, { maxBytes: backofficeResponseLimitBytes });
      }

      const assignmentProposalApplyMatch = url.pathname.match(/^\/api\/ai\/assignment-proposals\/([A-Za-z][A-Za-z0-9._:-]{2,127})\/apply$/);
      const assignmentProposalReviewMatch = url.pathname.match(/^\/api\/ai\/assignment-proposals\/([A-Za-z][A-Za-z0-9._:-]{2,127})\/review$/);
      if (request.method === "POST" && assignmentProposalReviewMatch) {
        const input = await readJson(request);
        const scopedProjectId = url.searchParams.get("projectId");
        if (input.projectId !== undefined && input.projectId !== scopedProjectId) {
          throw new DashboardCommandError("AI_ASSIGNMENT_PROJECT_SCOPE_MISMATCH", "محدودهٔ پروژه در درخواست یکسان نیست.", 400);
        }
        const projectId = scopedProjectId ?? input.projectId;
        if (typeof projectId !== "string" || !/^[A-Za-z][A-Za-z0-9._:-]{2,127}$/.test(projectId)) {
          throw new DashboardCommandError("PROJECT_SCOPE_REQUIRED", "پروژهٔ معتبر برای بازبینی لازم است.", 400);
        }
        const result = await reviewAssignmentProposal({ proposalId: assignmentProposalReviewMatch[1], projectId });
        return json(response, 200, { service: HERO_SERVICE, result }, { maxBytes: backofficeResponseLimitBytes });
      }
      if (request.method === "POST" && assignmentProposalApplyMatch) {
        const input = await readJson(request);
        const scopedProjectId = url.searchParams.get("projectId");
        if (input.projectId !== undefined && input.projectId !== scopedProjectId) {
          throw new DashboardCommandError("AI_ASSIGNMENT_PROJECT_SCOPE_MISMATCH", "محدودهٔ پروژه در درخواست یکسان نیست.", 400);
        }
        const projectId = scopedProjectId ?? input.projectId;
        if (typeof projectId !== "string" || !/^[A-Za-z][A-Za-z0-9._:-]{2,127}$/.test(projectId)) {
          throw new DashboardCommandError("PROJECT_SCOPE_REQUIRED", "پروژهٔ معتبر برای ثبت تخصیص لازم است.", 400);
        }
        const result = await applyAssignmentProposal({ proposalId: assignmentProposalApplyMatch[1], projectId, actor: authenticatedOwner.actor });
        return json(response, 200, { service: HERO_SERVICE, result }, { maxBytes: backofficeResponseLimitBytes });
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

      const providerHealthMatch = url.pathname.match(/^\/api\/ai\/providers\/([a-z][a-z0-9-]{2,63})\/health$/);
      if (request.method === "POST" && providerHealthMatch) {
        const input = await readJson(request);
        const providerId = providerHealthMatch[1];
        const result = await executeDashboardCommand("ai.provider-health-check", { ...input, providerId, actor: authenticatedOwner.actor }, () => dashboard.checkAiProviderHealth({ ...input, providerId, actor: authenticatedOwner.actor }), authenticatedOwner.actor);
        return json(response, 200, { service: HERO_SERVICE, result });
      }

      const aiCommandRoutes = {
        "/api/ai/providers": ["registerAiProvider", 201, "ai.provider-register"],
        "/api/ai/models": ["registerAiModel", 201, "ai.model-register"],
        "/api/ai/profiles": ["registerAiProfile", 201, "ai.profile-register"],
        "/api/ai/bindings": ["bindAiRole", 201, "ai.binding-create"],
        "/api/ai/project-scopes": ["configureAiProjectScope", 201, "ai.project-scope-configure"],
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

    if (request.method === "GET" && url.pathname === "/build-info") {
      return json(response, 200, {
        service: HERO_SERVICE,
        releaseVersion,
        sourceCommit,
        imageDigest,
        serviceVersion: HERO_VERSION,
        smartTesterRepositoryContext: `read-only/${HERO_REPOSITORY_READ_CONTEXT_VERSION}`,
        walkthroughGuideRepositoryContext: `read-only/${HERO_REPOSITORY_READ_CONTEXT_VERSION}`
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
        runnerContract: getRunnerContractSummary(),
        productRunnerContract: getProductRunnerContractSummary()
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
      const known = error instanceof DashboardCommandError || error instanceof ProductDevelopmentError || error instanceof ProjectAccessError || error instanceof ProjectWorkspaceError || error instanceof ProjectSettingsError || error instanceof CollaborationError || error instanceof CommandCenterError || error instanceof SystemCatalogError || error instanceof PerformanceError || error instanceof NotificationError || error instanceof InfrastructureError || error instanceof DeliveryError || error instanceof HardeningError || error instanceof FinalReadinessError || error instanceof BackofficeCompletionError || error instanceof HeroSecretStoreError || error instanceof AiOrchestrationError || error instanceof FormSuggestionsError || error instanceof ProjectIntakeAdvisorError;
      const auth = error instanceof OwnerAuthError || error instanceof HumanIdentityError;
      const statusCode = auth ? error.statusCode : known ? (error.statusCode ?? error.status ?? 409) : 500;
      if (statusCode >= 500) console.error(JSON.stringify({ level: "error", event: "hero.request-failed", method: request.method, path: url.pathname, status: statusCode, code: auth || known ? error.code : "INTERNAL_ERROR" }));
      return json(response, statusCode, {
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
        const purgedProjectIds = new Set();
        if (workspaceStore.listProjectPurgeTombstones && projectWorkspace.hydratePurgeTombstone) {
          for (const tombstone of await workspaceStore.listProjectPurgeTombstones()) {
            projectWorkspace.hydratePurgeTombstone({ projectId: tombstone.projectId });
            purgedProjectIds.add(tombstone.projectId);
          }
        }
        if (workspaceStore.listSettings && projectSettings.hydrateRecord) {
          for (const setting of await workspaceStore.listSettings()) {
            if (purgedProjectIds.has(setting.projectId)) continue;
            projectSettings.hydrateRecord({ ...setting, actorId: setting.actor });
            persistedWorkspaceRecords.add(workspaceRecordKey("setting", setting));
          }
        }
        if (workspaceStore.listProjects && projectWorkspace.hydrateProject) {
          for (const project of await workspaceStore.listProjects()) {
            if (purgedProjectIds.has(project.projectId)) continue;
            projectWorkspace.hydrateProject({ project });
            persistedWorkspaceRecords.add(workspaceRecordKey("project", project));
          }
        }
        if (workspaceStore.listInputs && projectWorkspace.hydrateInput) {
          for (const input of await workspaceStore.listInputs()) {
            if (purgedProjectIds.has(input.projectId)) continue;
            try { projectWorkspace.hydrateInput({ input }); persistedWorkspaceRecords.add(workspaceRecordKey("input", input)); } catch { /* a corrupt input row must not expose bytes or stop unrelated startup */ }
          }
        }
        if (workspaceStore.listFoundationProposals && projectWorkspace.hydrateFoundation) {
          for (const proposal of await workspaceStore.listFoundationProposals()) {
            if (purgedProjectIds.has(proposal.projectId)) continue;
            projectWorkspace.hydrateFoundation({ proposal });
            persistedWorkspaceRecords.add(workspaceRecordKey("proposal", proposal));
          }
        }
        if (workspaceStore.listImportPlans && projectWorkspace.hydrateImport) {
          for (const plan of await workspaceStore.listImportPlans()) {
            if (purgedProjectIds.has(plan.projectId)) continue;
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
