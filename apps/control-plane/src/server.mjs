import http from "node:http";
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
  getWorkflowContractSummary
} from "../../../packages/contracts/src/index.mjs";
import { DashboardCommandError, createControlDashboard } from "./dashboard-service.mjs";
import { getDashboardHtml } from "./dashboard-view.mjs";
import { getBackofficeHtml } from "./backoffice-view.mjs";
import { OwnerAuthError, createOwnerAuth } from "../../../packages/domain/src/owner-auth.mjs";
import { createConfiguredAiProviderAdapters, createPostgresRuntime } from "../../../packages/adapters/src/index.mjs";

const PRIVATE_ROBOTS_POLICY = "noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate";
const READ_MODEL_AUDIT_RESOURCES = new Set([
  "/backoffice",
  "/backoffice-data",
  "/backoffice-events",
  "/api/dashboard",
  "/api/ai/benchmarks",
  "/api/ai/benchmarks/compare",
  "/api/audit"
]);

function json(response, statusCode, body) {
  const payload = JSON.stringify(body);
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store",
    "x-robots-tag": PRIVATE_ROBOTS_POLICY
  });
  response.end(payload);
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

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16_384) throw new DashboardCommandError("PAYLOAD_TOO_LARGE", "درخواست بیش از حد بزرگ است.");
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

function optionalCostUnits(envName) {
  const raw = process.env[envName];
  if (raw === undefined || raw.trim() === "") return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) throw new Error(`${envName} must be a non-negative number.`);
  return value;
}

export function createHeroServer(options = {}) {
  const host = options.host ?? process.env.HERO_HTTP_HOST ?? "127.0.0.1";
  const port = parsePort(options.port ?? process.env.HERO_HTTP_PORT ?? "3100");
  const backofficeAuth = basicAuthConfig(options);
  const providerAdapterOptions = options.providerAdapterOptions ?? {
    openai: { costUnitsPer1kTokens: optionalCostUnits("HERO_OPENAI_COST_UNITS_PER_1K_TOKENS") },
    anthropic: { costUnitsPer1kTokens: optionalCostUnits("HERO_ANTHROPIC_COST_UNITS_PER_1K_TOKENS") },
    google: { costUnitsPer1kTokens: optionalCostUnits("HERO_GOOGLE_COST_UNITS_PER_1K_TOKENS") },
    "openai-compatible": { costUnitsPer1kTokens: optionalCostUnits("HERO_OPENAI_COMPATIBLE_COST_UNITS_PER_1K_TOKENS") }
  };
  const providerAdapters = options.providerAdapters ?? ((options.enableRealProviders === true || process.env.HERO_ENABLE_REAL_PROVIDERS === "true")
    ? createConfiguredAiProviderAdapters(providerAdapterOptions)
    : Object.freeze({}));
  const dashboard = options.dashboard ?? createControlDashboard({ now: options.now, providerAdapters, externalSpendAuthorizer: options.externalSpendAuthorizer });
  const ownerAuth = options.ownerAuth ?? createOwnerAuth({ secret: process.env.HERO_OWNER_AUTH_SECRET, now: options.now });
  let postgresRuntime = options.postgresRuntime ?? null;
  let ownsPostgresRuntime = false;
  let persistedDomainEventIds = new Set();

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
    if (!postgresRuntime?.store || typeof dashboard.domainEvents !== "function") return;
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

  async function executeDashboardCommand(command, input, operation) {
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
            actor: { kind: "project-owner", id: "hero-owner" },
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
        actor: { kind: "project-owner", id: "hero-owner" },
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
      const protectedBackofficePath = request.method === "GET" && ["/backoffice", "/backoffice-data", "/backoffice-events"].includes(url.pathname);
      if (protectedBackofficePath && backofficeAuth && !matchesBasicAuth(basicCredentials(request), backofficeAuth)) {
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

      if (request.method === "GET" && url.pathname === "/robots.txt") {
        return plain(response, 200, "User-agent: *\nDisallow: /\n");
      }

      if (request.method === "GET" && url.pathname === "/backoffice") {
        await recordReadAccess("/backoffice", "accepted", { kind: backofficeAuth ? "backoffice-basic-auth" : "project-owner", id: backofficeAuth ? "backoffice-user" : "development-local" });
        return html(response, getBackofficeHtml());
      }

      if (request.method === "GET" && url.pathname === "/backoffice-data") {
        await recordReadAccess("/backoffice-data", "accepted", { kind: backofficeAuth ? "backoffice-basic-auth" : "project-owner", id: backofficeAuth ? "backoffice-user" : "development-local" });
        return json(response, 200, { service: HERO_SERVICE, backoffice: dashboard.backofficeSnapshot() });
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
          });
        }
        return json(response, 200, { service: HERO_SERVICE, ...dashboard.backofficeEvents({ after, limit }) });
      }

      const authenticatedOwner = url.pathname.startsWith("/api/")
        ? ownerAuth.requireOwner(request.headers.authorization)
        : null;

      if (request.method === "GET" && READ_MODEL_AUDIT_RESOURCES.has(url.pathname)) {
        await recordReadAccess(url.pathname, "accepted", { kind: "project-owner", id: authenticatedOwner?.subject ?? "development-local" });
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

      if (request.method === "GET" && url.pathname === "/") {
        return html(response, getDashboardHtml());
      }

      if (request.method === "GET" && url.pathname === "/api/dashboard") {
        return json(response, 200, { service: HERO_SERVICE, dashboard: dashboard.snapshot() });
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
      if (request.method === "POST" && url.pathname === "/api/ai/benchmarks/synthetic") {
        const input = await readJson(request);
        const result = await executeDashboardCommand("ai.benchmark.synthetic", input, () => dashboard.runSyntheticBenchmark(input));
        return json(response, 201, { service: HERO_SERVICE, result });
      }
      if (request.method === "POST" && aiCommandRoutes[url.pathname]) {
        const input = await readJson(request);
        const [command, statusCode, auditCommand] = aiCommandRoutes[url.pathname];
        const result = await executeDashboardCommand(auditCommand, input, () => dashboard[command](input));
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
        const result = await executeDashboardCommand(`team.${action}`, input, () => teamByAction[action](teamId, input));
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
      if (error instanceof OwnerAuthError && request.method === "GET" && READ_MODEL_AUDIT_RESOURCES.has(url.pathname)) {
        await recordReadAccess(url.pathname, "rejected");
      }
      const known = error instanceof DashboardCommandError;
      const auth = error instanceof OwnerAuthError;
      return json(response, auth ? error.statusCode : known ? 409 : 500, {
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
        ownerAuth.restoreRevocations(await postgresRuntime.ownerSessions.list());
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
