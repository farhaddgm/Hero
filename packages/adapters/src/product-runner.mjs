import { execFile as execFileCallback } from "node:child_process";
import { lstatSync, readFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import {
  PRODUCT_RUNNER_ACTIONS,
  PRODUCT_RUNNER_AUTH_OPERATIONS,
  PRODUCT_RUNNER_DEFAULTS,
  getProductRunnerContractSummary
} from "../../contracts/src/product-runner.mjs";
import { evaluateProductRuntimeAdmission } from "../../domain/src/product-factory.mjs";

const execFile = promisify(execFileCallback);
const DIGEST_ARTIFACT = /^[A-Za-z0-9._/-]+@sha256:[a-f0-9]{64}$/;
const SAFE_RELATIVE = /^[A-Za-z0-9._/-]+$/;
const SAFE_SERVICE = /^[a-z][a-z0-9_.-]{1,62}$/;
const SECRET_KEY = /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|credential|secret)/i;
const SECRET_VALUE = /(?:\bsk-[A-Za-z0-9_-]{12,}\b|\bBearer\s+[A-Za-z0-9._-]{12,}\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/i;

function immutableCopy(value) { return Object.freeze(structuredClone(value)); }

function assertText(label, value, maximum = 128) {
  if (typeof value !== "string" || value.length < 3 || value.length > maximum) throw new Error(`${label} is invalid.`);
  return value;
}

function assertSafeRelative(label, value) {
  assertText(label, value, 240);
  if (path.isAbsolute(value) || value.includes("\\") || value.split("/").includes("..") || value.startsWith(".hero")) throw new Error(`${label} must be a safe relative path.`);
  if (!SAFE_RELATIVE.test(value)) throw new Error(`${label} contains unsupported characters.`);
  return value;
}

function assertAbsoluteDirectory(label, value) {
  assertText(label, value, 1_024);
  if (!path.isAbsolute(value)) throw new Error(`${label} must be absolute.`);
  const stat = lstatSync(value);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`${label} must be a real directory.`);
  return path.resolve(value);
}

function assertRegularPath(label, value) {
  const stat = lstatSync(value);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`${label} must be a regular file.`);
}

function scalar(source, key) {
  return source.match(new RegExp(`^\\s+${key}:\\s*["']?([^\\s#"']+)`, "mi"))?.[1] ?? null;
}

function memoryBytes(value) {
  const match = String(value ?? "").match(/^([0-9]+(?:\\.[0-9]+)?)(b|k|kb|m|mb|g|gb|mi|mib|gi|gib)?$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = (match[2] ?? "b").toLowerCase();
  const factor = { b: 1, k: 1_000, kb: 1_000, m: 1_000_000, mb: 1_000_000, g: 1_000_000_000, gb: 1_000_000_000, mi: 1_048_576, mib: 1_048_576, gi: 1_073_741_824, gib: 1_073_741_824 }[unit];
  return factor ? amount * factor : null;
}

function assertImmutableComposeStart(composePath, artifact, plan) {
  if (lstatSync(composePath).size > 1_000_000) throw new Error("start Compose file exceeds the safe inspection limit.");
  const source = readFileSync(composePath, "utf8");
  const images = [...source.matchAll(/^\s*image:\s*([^\s#]+)\s*(?:#.*)?$/gmi)].map(match => match[1]);
  if (!images.length || !images.includes(artifact) || images.some(image => !DIGEST_ARTIFACT.test(image))) throw new Error("start requires every Compose image to use the requested immutable digest.");
  const cpuLimit = Number(scalar(source, "cpus"));
  const memoryLimit = memoryBytes(scalar(source, "mem_limit"));
  const pidsLimit = Number(scalar(source, "pids_limit"));
  const expectedMemory = plan.resources.memoryMiB * 1_048_576;
  if (!Number.isFinite(cpuLimit) || cpuLimit <= 0 || cpuLimit > plan.resources.cpuLimit || !Number.isFinite(memoryLimit) || memoryLimit <= 0 || memoryLimit > expectedMemory || !Number.isInteger(pidsLimit) || pidsLimit < 1 || pidsLimit > plan.resources.pidsLimit) throw new Error("start Compose resource limits exceed the product plan.");
  if (!/^\s+network_mode:\s+none\s*$/mi.test(source) || !/^\s+read_only:\s+true\s*$/mi.test(source) || !/^\s+user:\s*["']?(?!0(?:["']?$|:)|root(?:["']?$))[^\s#"']+/mi.test(source) || !/^\s+security_opt:\s*$/mi.test(source) || !/no-new-privileges(?::|=)true/i.test(source) || !/^\s+cap_drop:\s*$/mi.test(source) || !/^\s+-\s+ALL\s*$/mi.test(source) || /^(?:\s*)(?:privileged|pid|ipc|uts|network_mode):\s*(?:true|host)\s*$/mi.test(source) || source.includes("/var/run/docker.sock")) throw new Error("start Compose security boundary is invalid.");
  if (/^\s+(?:volumes|devices):\s*$/mi.test(source) && /(?:^|\n)\s+-\s+(?:[.~\/]|[A-Za-z]:[\\/])/.test(source)) throw new Error("start Compose host mount boundary is invalid.");
}

function assertNoSensitiveInput(value, key = "input") {
  if (typeof value === "string") {
    if (SECRET_VALUE.test(value)) throw new Error(`${key} contains a sensitive value.`);
    return;
  }
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) { for (const item of value) assertNoSensitiveInput(item, key); return; }
  for (const [childKey, childValue] of Object.entries(value)) {
    if (childKey === "secretWrite" && childValue === false) continue;
    if (SECRET_KEY.test(childKey) && childKey !== "authorizationId") throw new Error(`${key}.${childKey} is not accepted.`);
    assertNoSensitiveInput(childValue, `${key}.${childKey}`);
  }
}

function validDecision(decision, { projectId, runId, stepId, documentVersion, operation }) {
  if (!decision || decision.authorized !== true || decision.code !== "AUTHORIZED" || decision.globalStop === true || decision.safeCheckpointRequired === true) return false;
  return decision.projectId === projectId && decision.runId === runId && decision.stepId === stepId && decision.documentVersion === documentVersion && decision.operation === operation;
}

function validRuntimeAuthorization(authorization, { projectId, runId, stepId, documentVersion, operation }) {
  if (!authorization || typeof authorization.authorizationId !== "string" || authorization.authorized !== true || authorization.code !== "AUTHORIZED" || authorization.globalStop === true || authorization.safeCheckpointRequired === true) return false;
  return authorization.projectId === projectId && authorization.runId === runId && authorization.stepId === stepId && authorization.documentVersion === documentVersion && authorization.operation === operation && PRODUCT_RUNNER_AUTH_OPERATIONS.includes(operation);
}

function safeDuration(value) {
  return Number.isFinite(value) && value >= 0 ? Math.min(Math.floor(value), 86_400_000) : null;
}

function executionSummary(raw, startedAt) {
  const exitCode = Number.isInteger(raw?.exitCode) ? raw.exitCode : 0;
  const stdout = typeof raw?.stdout === "string" ? Buffer.byteLength(raw.stdout, "utf8") : 0;
  const stderr = typeof raw?.stderr === "string" ? Buffer.byteLength(raw.stderr, "utf8") : 0;
  return Object.freeze({
    exitCode,
    durationMs: safeDuration(raw?.durationMs) ?? safeDuration(Date.now() - startedAt),
    stdoutBytes: stdout,
    stderrBytes: stderr,
    timedOut: raw?.timedOut === true,
    outputRedacted: true
  });
}

function blocked(code, input, extra = {}) {
  return immutableCopy({
    status: "blocked",
    code,
    action: input?.action ?? null,
    projectId: input?.projectId ?? null,
    runId: input?.runId ?? null,
    sideEffects: "none",
    ...extra
  });
}

function failed(code, input, result = null) {
  return immutableCopy({
    status: "failed",
    code,
    action: input.action,
    projectId: input.projectId,
    runId: input.runId,
    sideEffects: "bounded-product-scope",
    result
  });
}

function validateWorkspaceChain(root, workspace) {
  let current = workspace;
  while (true) {
    if (current !== root && !current.startsWith(`${root}${path.sep}`)) throw new Error("workspace path escaped the configured product runner root.");
    const stat = lstatSync(current);
    if (stat.isSymbolicLink()) throw new Error("workspace path contains a symlink.");
    if (current === root) return;
    current = path.dirname(current);
  }
}

function commandBase({ project, workspacePath, composePath }) {
  return ["compose", "--project-name", project, "--project-directory", workspacePath, "--file", composePath];
}

function commandFor(action, input, workspacePath, composePath) {
  const base = commandBase({ project: input.plan.isolation.composeProject, workspacePath, composePath });
  if (action === "preflight") return [...base, "config", "--quiet"];
  if (action === "build") return [...base, "build", "--pull=never", "--network", "none"];
  if (action === "test") return [...base, "run", "--rm", "--no-deps", "--no-build", "--network", "none", input.runtimeSpec.serviceName];
  if (action === "start") return [...base, "up", "--detach", "--no-build", "--remove-orphans"];
  if (action === "stop" || action === "cleanup") return [...base, "down", "--remove-orphans"];
  throw new Error("Unsupported Product Runner action.");
}

export function createDockerProductExecutor() {
  return async ({ argv, cwd, timeoutMs }) => {
    const startedAt = Date.now();
    try {
      const result = await execFile("docker", argv, {
        cwd,
        shell: false,
        timeout: timeoutMs,
        maxBuffer: 1_000_000,
        windowsHide: true,
        env: { PATH: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin" }
      });
      return { ...result, exitCode: 0, durationMs: Date.now() - startedAt };
    } catch (error) {
      return {
        exitCode: Number.isInteger(error?.code) ? error.code : 1,
        stdout: typeof error?.stdout === "string" ? error.stdout : "",
        stderr: typeof error?.stderr === "string" ? error.stderr : "",
        durationMs: Date.now() - startedAt,
        timedOut: error?.code === "ETIMEDOUT"
      };
    }
  };
}

export function createDockerProductRunner({ workspaceRoot, executor = null, now = () => Date.now() } = {}) {
  const root = assertAbsoluteDirectory("workspaceRoot", workspaceRoot);
  if (executor !== null && typeof executor !== "function") throw new Error("executor must be a function when configured.");
  const activeRuns = new Set();

  function normalize(input = {}) {
    assertNoSensitiveInput(input);
    if (!PRODUCT_RUNNER_ACTIONS.includes(input.action)) throw new Error("Product Runner action is not supported.");
    const plan = input.plan;
    const admission = evaluateProductRuntimeAdmission({
      plan,
      networkMode: input.runtimeSpec?.networkMode ?? PRODUCT_RUNNER_DEFAULTS.networkMode,
      ports: input.runtimeSpec?.ports ?? plan?.isolation?.ports,
      reservedPorts: input.runtimeSpec?.reservedPorts ?? [],
      resourceNames: input.runtimeSpec?.resourceNames ?? [plan?.isolation?.composeProject, plan?.isolation?.database, plan?.isolation?.volume, plan?.isolation?.network].filter(Boolean),
      reservedResourceNames: input.runtimeSpec?.reservedResourceNames ?? [],
      hostPaths: input.runtimeSpec?.hostPaths ?? [],
      resourceLimits: input.runtimeSpec?.resourceLimits ?? {
        cpuLimit: plan?.resources?.cpuLimit,
        memoryMiB: plan?.resources?.memoryMiB,
        pidsLimit: plan?.resources?.pidsLimit,
        timeoutSeconds: plan?.execution?.timeoutSeconds,
        maxConcurrentRuns: plan?.execution?.maxConcurrentRuns
      }
    });
    const projectId = assertText("projectId", input.projectId);
    const runId = assertText("runId", input.runId);
    if (!plan || plan.projectId !== projectId) throw new Error("Product Runner project scope does not match the runtime plan.");
    const workspaceKey = assertSafeRelative("workspaceKey", input.runtimeSpec?.workspaceKey);
    const expectedPrefix = `${PRODUCT_RUNNER_DEFAULTS.workspaceKeyPrefix}/${projectId}/`;
    if (!workspaceKey.startsWith(expectedPrefix)) throw new Error("workspaceKey is not scoped to the product project.");
    const workspacePath = path.resolve(root, workspaceKey);
    validateWorkspaceChain(root, workspacePath);
    const composeFile = assertSafeRelative("composeFile", input.runtimeSpec?.composeFile ?? PRODUCT_RUNNER_DEFAULTS.composeFile);
    const composePath = path.resolve(workspacePath, composeFile);
    if (!composePath.startsWith(`${workspacePath}${path.sep}`)) throw new Error("composeFile escaped the workspace.");
    assertRegularPath("composeFile", composePath);
    const serviceName = assertText("serviceName", input.runtimeSpec?.serviceName, 64);
    if (!SAFE_SERVICE.test(serviceName)) throw new Error("serviceName is invalid.");
    if (input.action === "start" && (!DIGEST_ARTIFACT.test(input.runtimeSpec?.artifact ?? ""))) throw new Error("start requires an immutable image digest.");
    if (input.action === "start") assertImmutableComposeStart(composePath, input.runtimeSpec.artifact, plan);
    if (admission.decision !== "admit") return { projectId, runId, plan, workspaceKey, workspacePath, composePath, serviceName, admission };
    return { projectId, runId, plan, workspaceKey, workspacePath, composePath, serviceName, admission };
  }

  function preflight(input = {}) {
    try {
      const normalized = normalize({ ...input, action: "preflight" });
      return immutableCopy({
        status: normalized.admission.decision === "admit" ? "ready" : "blocked",
        code: normalized.admission.decision === "admit" ? "PRODUCT_RUNNER_READY" : "PRODUCT_RUNNER_ADMISSION_REJECTED",
        action: "preflight",
        projectId: normalized.projectId,
        runId: normalized.runId,
        workspaceKey: normalized.workspaceKey,
        isolated: true,
        admission: normalized.admission,
        command: ["docker", ...commandFor("preflight", { ...input, plan: normalized.plan }, normalized.workspacePath, normalized.composePath)],
        sideEffects: "none"
      });
    } catch (error) {
      return blocked("PRODUCT_RUNNER_ADMISSION_REJECTED", { ...input, action: "preflight" }, { reason: "input-or-filesystem-boundary-rejected" });
    }
  }

  async function execute(input = {}) {
    let normalized;
    try { normalized = normalize(input); } catch { return blocked("PRODUCT_RUNNER_ADMISSION_REJECTED", input); }
    if (normalized.admission.decision !== "admit") return blocked("PRODUCT_RUNNER_ADMISSION_REJECTED", input, { admission: normalized.admission });
    if (input.action === "preflight") return preflight(input);
    if (normalized.plan.execution?.mode !== "isolated-test") return blocked("PRODUCT_RUNNER_MODE_NOT_ENABLED", input);
    if (normalized.plan.state !== "approved") return blocked("PRODUCT_RUNNER_PLAN_NOT_APPROVED", input);

    const operation = `product-test-${input.action}`;
    const dispatchOperation = input.action === "build" ? "develop" : "test";
    if (["build", "test", "start"].includes(input.action) && !validDecision(input.dispatchDecision, { ...input, ...normalized, operation: dispatchOperation })) {
      return blocked("PRODUCT_RUNNER_AUTHORIZATION_REQUIRED", input);
    }
    if (!validRuntimeAuthorization(input.runtimeAuthorization, { ...input, ...normalized, operation })) {
      return blocked("PRODUCT_RUNNER_AUTHORIZATION_REQUIRED", input);
    }
    if (executor === null) return blocked("PRODUCT_RUNNER_EXECUTOR_NOT_CONFIGURED", input);
    const runKey = `${normalized.projectId}:${normalized.runId}`;
    if (activeRuns.has(runKey)) return blocked("PRODUCT_RUNNER_CONCURRENCY_LIMIT", input);
    activeRuns.add(runKey);

    try {
      const commands = input.action === "preflight" ? [commandFor("preflight", input, normalized.workspacePath, normalized.composePath)] : [commandFor("preflight", input, normalized.workspacePath, normalized.composePath), commandFor(input.action, input, normalized.workspacePath, normalized.composePath)];
      const startedAt = now();
      const results = [];
      for (const argv of commands) {
        try {
          const raw = await executor({ argv: Object.freeze([...argv]), cwd: normalized.workspacePath, timeoutMs: normalized.plan.execution.timeoutSeconds * 1_000 });
          const result = executionSummary(raw, startedAt);
          results.push(result);
          if (result.exitCode !== 0) return failed("PRODUCT_RUNNER_EXECUTOR_FAILED", input, { steps: results.length, last: result });
        } catch {
          return failed("PRODUCT_RUNNER_EXECUTOR_FAILED", input, { steps: results.length, last: { exitCode: null, durationMs: safeDuration(now() - startedAt), timedOut: false, outputRedacted: true } });
        }
      }
      return immutableCopy({ status: "completed", code: "PRODUCT_RUNNER_OUTPUT_REDACTED", action: input.action, projectId: normalized.projectId, runId: normalized.runId, sideEffects: "bounded-product-scope", result: { steps: results.length, last: results.at(-1) } });
    } finally {
      activeRuns.delete(runKey);
    }
  }

  return Object.freeze({ preflight, execute, contract: () => getProductRunnerContractSummary() });
}
