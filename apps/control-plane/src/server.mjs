import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  HERO_SERVICE,
  HERO_VERSION,
  getAuthorizationContractSummary,
  getAssuranceGateContractSummary,
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
  getWebFactoryContractSummary,
  getWorkflowContractSummary
} from "../../../packages/contracts/src/index.mjs";
import { DashboardCommandError, createControlDashboard } from "./dashboard-service.mjs";
import { getDashboardHtml } from "./dashboard-view.mjs";
import { OwnerAuthError, createOwnerAuth } from "../../../packages/domain/src/owner-auth.mjs";
import { createPostgresRuntime } from "../../../packages/adapters/src/postgresql-runtime.mjs";

function json(response, statusCode, body) {
  const payload = JSON.stringify(body);
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store"
  });
  response.end(payload);
}

function html(response, body) {
  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "content-security-policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "cache-control": "no-store"
  });
  response.end(body);
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

export function createHeroServer(options = {}) {
  const host = options.host ?? process.env.HERO_HTTP_HOST ?? "127.0.0.1";
  const port = parsePort(options.port ?? process.env.HERO_HTTP_PORT ?? "3100");
  const dashboard = options.dashboard ?? createControlDashboard({ now: options.now });
  const ownerAuth = options.ownerAuth ?? createOwnerAuth({ secret: process.env.HERO_OWNER_AUTH_SECRET, now: options.now });
  let postgresRuntime = options.postgresRuntime ?? null;
  let ownsPostgresRuntime = false;

  async function executeDashboardCommand(command, input, operation) {
    const result = await operation();
    if (postgresRuntime?.audit) {
      const projectId = input?.projectId ?? result?.projectId ?? result?.request?.projectId ?? result?.result?.projectId ?? "hero";
      await postgresRuntime.audit.record({
        command,
        projectId,
        actor: { kind: "project-owner", id: "hero-owner" }
      });
    }
    return result;
  }

  const server = http.createServer((request, response) => void handle(request, response));

  async function handle(request, response) {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

    try {
      if (url.pathname.startsWith("/api/")) ownerAuth.requireOwner(request.headers.authorization);

      if (request.method === "GET" && url.pathname === "/") {
        return html(response, getDashboardHtml());
      }

      if (request.method === "GET" && url.pathname === "/api/dashboard") {
        return json(response, 200, { service: HERO_SERVICE, dashboard: dashboard.snapshot() });
      }

      if (request.method === "GET" && url.pathname === "/api/teams") {
        return json(response, 200, { service: HERO_SERVICE, teamControl: dashboard.teamSnapshot() });
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

      const teamMatch = url.pathname.match(/^\/api\/teams\/([a-z][a-z0-9-]{2,63})\/(review|rework|deliverable-review|autonomy|training|assign|split)$/);
      if (request.method === "POST" && teamMatch) {
        const input = await readJson(request);
        const [, teamId, action] = teamMatch;
        const teamByAction = {
          review: dashboard.reviewTeam,
          rework: dashboard.requestTeamRework,
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

      return json(response, 404, {
        service: HERO_SERVICE,
        status: "not_found"
      });
    } catch (error) {
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
