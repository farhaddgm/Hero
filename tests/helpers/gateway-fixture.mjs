import { createAuthorizationEngine } from "../../packages/domain/src/authorization-engine.mjs";
import { createAgentToolGateway } from "../../packages/domain/src/agent-tool-gateway.mjs";

export const owner = Object.freeze({ kind: "project-owner", id: "hero-owner" });

export const TOOLS = Object.freeze({
  read: {
    toolId: "repo.read", title: "خواندن فایل پروژه", summary: "یک فایل متنی را از مخزن پروژه می‌خواند.",
    riskTier: "read", argumentSchema: { path: { type: "relative-path", required: true } }
  },
  note: {
    toolId: "notes.add", title: "افزودن یادداشت", summary: "یک یادداشت کوتاه برای تیم ثبت می‌کند.",
    riskTier: "read", argumentSchema: { text: { type: "string", required: true, maxLength: 500 } }
  },
  write: {
    toolId: "repo.write", title: "نوشتن فایل پروژه", summary: "محتوای یک فایل را در worktree ایزوله می‌نویسد.",
    riskTier: "local-write", argumentSchema: { path: { type: "relative-path", required: true }, content: { type: "string", required: true, maxLength: 5000 } }
  },
  fetch: {
    toolId: "web.fetch", title: "دریافت صفحهٔ وب", summary: "یک صفحهٔ عمومی را برای تحقیق می‌خواند.",
    riskTier: "external-read", argumentSchema: { url: { type: "https-url", required: true } }
  },
  drop: {
    toolId: "db.drop", title: "حذف پایگاه داده", summary: "یک پایگاه داده را برای همیشه حذف می‌کند.",
    riskTier: "sensitive", sensitiveAction: "destructive-data-operation", argumentSchema: { database: { type: "enum", values: ["staging", "production"], required: true } }
  },
  deploy: {
    toolId: "prod.deploy", title: "انتشار Production", summary: "نسخه را در Production منتشر می‌کند.",
    riskTier: "sensitive", sensitiveAction: "production-deploy", argumentSchema: { version: { type: "string", required: true, maxLength: 40 } }
  }
});

/** A gateway with a controllable clock, Global Stop switch and a real authorization engine. */
export function createFixture(options = {}) {
  let clock = Date.parse("2026-10-09T10:00:00.000Z");
  let stopped = false;
  const now = () => new Date(clock).toISOString();
  const authorization = createAuthorizationEngine({ now });
  const gateway = createAgentToolGateway({ now, globalStop: () => stopped, authorization, ...options });
  for (const definition of Object.values(TOOLS)) gateway.registerTool({ actor: owner, definition });
  gateway.grantAgent({ actor: owner, agentId: "agent-codex", toolIds: Object.values(TOOLS).map(tool => tool.toolId), projectIds: ["project-alpha"] });
  authorization.grant({
    authorizationId: "AUTH-GW-001", mode: "direct", entries: [{ stepId: "STEP-GW-001", documentVersion: "v1.0" }],
    operations: ["develop"], actor: owner, idempotencyKey: "idem-grant-gw-001"
  });
  const call = (overrides = {}) => {
    const toolId = overrides.toolId ?? "repo.read";
    return gateway.evaluateCall({
      agentId: "agent-codex", projectId: "project-alpha", toolId,
      observedDefinitionDigest: gateway.toolDigest(toolId) ?? undefined,
      args: { path: "src/index.mjs" },
      ...overrides
    });
  };
  return {
    gateway, authorization, call,
    advance: ms => { clock += ms; },
    stop: value => { stopped = value; },
    authorizationRef: { authorizationId: "AUTH-GW-001", stepId: "STEP-GW-001", documentVersion: "v1.0" }
  };
}
