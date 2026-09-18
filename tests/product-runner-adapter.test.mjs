import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  getProductRunnerContractSummary,
  validateProductRunnerContract
} from "../packages/contracts/src/product-runner.mjs";
import { createProductArtifactManifest } from "../packages/contracts/src/product-artifact.mjs";
import { createProductRuntimePlan } from "../packages/domain/src/product-factory.mjs";
import { createDockerProductExecutor, createDockerProductRunner } from "../packages/adapters/src/product-runner.mjs";
import { createProductRuntimeReservationRegistry } from "../packages/adapters/src/product-runtime-reservations.mjs";

const projectId = "project-safe";
const runId = "run-product-001";
const stepId = "PF2-RUNTIME-001";
const documentVersion = "v1.9.0";
const artifact = "ghcr.io/example/product@sha256:" + "a".repeat(64);

function fixture({ executor = null, planState = "approved", executionMode = "isolated-test" } = {}) {
  const root = mkdtempSync(path.join(os.tmpdir(), "hero-product-runner-"));
  const workspaceKey = `product-workspaces/${projectId}/${runId}`;
  const workspacePath = path.join(root, workspaceKey);
  mkdirSync(workspacePath, { recursive: true });
  writeFileSync(path.join(workspacePath, "compose.yaml"), "services:\n  app:\n    image: " + artifact + "\n    build:\n      context: .\n      network: none\n    user: \"1000:1000\"\n    read_only: true\n    security_opt:\n      - no-new-privileges:true\n    cap_drop:\n      - ALL\n    cpus: 1\n    mem_limit: 1024m\n    pids_limit: 256\n    network_mode: none\n");
  const plan = structuredClone(createProductRuntimePlan({ projectId }));
  plan.state = planState;
  plan.execution.mode = executionMode;
  const runtimeSpec = {
    workspaceKey,
    composeFile: "compose.yaml",
    serviceName: "app",
    artifact,
    resourceLimits: {
      cpuLimit: plan.resources.cpuLimit,
      memoryMiB: plan.resources.memoryMiB,
      pidsLimit: plan.resources.pidsLimit,
      timeoutSeconds: plan.execution.timeoutSeconds,
      maxConcurrentRuns: plan.execution.maxConcurrentRuns
    }
  };
  const base = { projectId, runId, stepId, documentVersion, plan, runtimeSpec };
  const dispatch = operation => ({
    authorized: true,
    code: "AUTHORIZED",
    globalStop: false,
    safeCheckpointRequired: false,
    projectId,
    runId,
    stepId,
    documentVersion,
    operation
  });
  const runtimeAuthorization = operation => ({
    authorizationId: "AUTH-PRODUCT-TEST-001",
    authorized: true,
    code: "AUTHORIZED",
    globalStop: false,
    safeCheckpointRequired: false,
    projectId,
    runId,
    stepId,
    documentVersion,
    operation
  });
  return {
    root,
    base,
    dispatch,
    runtimeAuthorization,
    runner: createDockerProductRunner({ workspaceRoot: root, executor })
  };
}

function cleanup(fixtureData) {
  rmSync(fixtureData.root, { recursive: true, force: true });
}

test("Product Runner contract is complete and safe by default", () => {
  assert.deepEqual(validateProductRunnerContract(), []);
  const summary = getProductRunnerContractSummary();
  assert.equal(summary.defaults.networkMode, "none");
  assert.equal(summary.defaults.shell, false);
  assert.ok(summary.authorizationOperations.includes("product-test-start"));
  assert.equal(summary.output, "stdout/stderr are never returned; only exit code, duration and byte counts are retained.");
});

test("preflight validates an approved isolated plan without executing Docker", () => {
  const data = fixture();
  try {
    const result = data.runner.preflight(data.base);
    assert.equal(result.status, "ready");
    assert.equal(result.code, "PRODUCT_RUNNER_READY");
    assert.equal(result.isolated, true);
    assert.equal(result.sideEffects, "none");
    assert.equal(result.command[0], "docker");
    assert.ok(result.command.includes("none") === false, "preflight must not inject a network escape");
    assert.ok(result.command.includes("config"));
  } finally { cleanup(data); }
});

test("default runner never executes a product without an explicitly configured executor", async () => {
  const data = fixture();
  try {
    const result = await data.runner.execute({
      ...data.base,
      action: "build",
      dispatchDecision: data.dispatch("develop"),
      runtimeAuthorization: data.runtimeAuthorization("product-test-build")
    });
    assert.equal(result.status, "blocked");
    assert.equal(result.code, "PRODUCT_RUNNER_EXECUTOR_NOT_CONFIGURED");
    assert.equal(result.sideEffects, "none");
  } finally { cleanup(data); }
});

test("build requires both the normal development decision and the separate Product Test authorization", async () => {
  const data = fixture();
  try {
    const missing = await data.runner.execute({ ...data.base, action: "build", runtimeAuthorization: data.runtimeAuthorization("product-test-build") });
    assert.equal(missing.code, "PRODUCT_RUNNER_AUTHORIZATION_REQUIRED");
    const wrongOperation = await data.runner.execute({
      ...data.base,
      action: "build",
      dispatchDecision: data.dispatch("test"),
      runtimeAuthorization: data.runtimeAuthorization("product-test-build")
    });
    assert.equal(wrongOperation.code, "PRODUCT_RUNNER_AUTHORIZATION_REQUIRED");
  } finally { cleanup(data); }
});

test("plan-only or unapproved plans are blocked before an executor can run", async () => {
  const calls = [];
  const data = fixture({ executor: async request => { calls.push(request); return { exitCode: 0, stdout: "ok", stderr: "" }; }, planState: "proposed", executionMode: "plan-only" });
  try {
    const result = await data.runner.execute({
      ...data.base,
      action: "start",
      dispatchDecision: data.dispatch("test"),
      runtimeAuthorization: data.runtimeAuthorization("product-test-start")
    });
    assert.equal(result.status, "blocked");
    assert.equal(result.code, "PRODUCT_RUNNER_MODE_NOT_ENABLED");
    assert.equal(calls.length, 0);
  } finally { cleanup(data); }
});

test("successful build uses argv-only Docker commands and returns only redacted metadata", async () => {
  const calls = [];
  const data = fixture({ executor: async request => { calls.push(request); return { exitCode: 0, stdout: "sk-live-never-return-this", stderr: "Bearer never-return-this", durationMs: 7 }; } });
  try {
    const result = await data.runner.execute({
      ...data.base,
      action: "build",
      dispatchDecision: data.dispatch("develop"),
      runtimeAuthorization: data.runtimeAuthorization("product-test-build")
    });
    assert.equal(result.status, "completed");
    assert.equal(result.code, "PRODUCT_RUNNER_OUTPUT_REDACTED");
    assert.equal(result.result.steps, 2);
    assert.equal(result.result.last.outputRedacted, true);
    assert.equal(Object.hasOwn(result, "stdout"), false);
    assert.equal(Object.hasOwn(result, "stderr"), false);
    assert.equal(calls.length, 2);
    for (const call of calls) {
      assert.equal(call.argv[0], "compose");
      assert.equal(call.cwd, path.join(data.root, data.base.runtimeSpec.workspaceKey));
      assert.equal(call.argv.includes("--network"), false);
      assert.equal(call.argv.includes("--pull=false"), false);
      assert.equal(call.argv.includes("host"), false);
      assert.equal(call.shell, undefined);
    }
  } finally { cleanup(data); }
});

test("test can use a bounded in-container executable without invoking a shell", async () => {
  const calls = [];
  const data = fixture({ executor: async request => { calls.push(request); return { exitCode: 0, stdout: "safe", stderr: "" }; } });
  try {
    const result = await data.runner.execute({
      ...data.base,
      action: "test",
      runtimeSpec: { ...data.base.runtimeSpec, testCommand: ["/opt/product/test"] },
      dispatchDecision: data.dispatch("test"),
      runtimeAuthorization: data.runtimeAuthorization("product-test-test")
    });
    assert.equal(result.status, "completed");
    assert.deepEqual(calls.at(-1).argv.slice(-2), ["app", "/opt/product/test"]);
    assert.equal(calls.at(-1).shell, undefined);
  } finally { cleanup(data); }
});

test("test command rejects shell escape attempts before execution", async () => {
  const calls = [];
  const data = fixture({ executor: async request => { calls.push(request); return { exitCode: 0 }; } });
  try {
    const result = await data.runner.execute({
      ...data.base,
      action: "test",
      runtimeSpec: { ...data.base.runtimeSpec, testCommand: ["/bin/sh", "-c", "cat /secret"] },
      dispatchDecision: data.dispatch("test"),
      runtimeAuthorization: data.runtimeAuthorization("product-test-test")
    });
    assert.equal(result.status, "blocked");
    assert.equal(result.code, "PRODUCT_RUNNER_ADMISSION_REJECTED");
    assert.equal(calls.length, 0);
  } finally { cleanup(data); }
});

test("a Product Run is reserved until its commands finish", async () => {
  let entered;
  let release;
  const enteredPromise = new Promise(resolve => { entered = resolve; });
  const releasePromise = new Promise(resolve => { release = resolve; });
  let calls = 0;
  const data = fixture({ executor: async () => {
    calls += 1;
    if (calls === 1) { entered(); await releasePromise; }
    return { exitCode: 0, stdout: "safe", stderr: "" };
  } });
  try {
    const input = { ...data.base, action: "build", dispatchDecision: data.dispatch("develop"), runtimeAuthorization: data.runtimeAuthorization("product-test-build") };
    const first = data.runner.execute(input);
    await enteredPromise;
    const second = await data.runner.execute(input);
    assert.equal(second.status, "blocked");
    assert.equal(second.code, "PRODUCT_RUNNER_CONCURRENCY_LIMIT");
    release();
    assert.equal((await first).status, "completed");
  } finally { cleanup(data); }
});

test("start requires an immutable image digest and uses no volume destruction", async () => {
  const calls = [];
  const data = fixture({ executor: async request => { calls.push(request); return { exitCode: 0, stdout: "safe", stderr: "" }; } });
  try {
    const invalidArtifact = { ...data.base, action: "start", runtimeSpec: { ...data.base.runtimeSpec, artifact: "latest" }, dispatchDecision: data.dispatch("test"), runtimeAuthorization: data.runtimeAuthorization("product-test-start") };
    assert.equal((await data.runner.execute(invalidArtifact)).code, "PRODUCT_RUNNER_ADMISSION_REJECTED");
    const result = await data.runner.execute({ ...data.base, action: "start", dispatchDecision: data.dispatch("test"), runtimeAuthorization: data.runtimeAuthorization("product-test-start") });
    assert.equal(result.status, "completed");
    assert.equal(calls.at(-1).argv.includes("up"), true);
    assert.equal(calls.at(-1).argv.includes("-v"), false);
    assert.equal(calls.at(-1).argv.includes("--remove-orphans"), true);
  } finally { cleanup(data); }
});

test("Product Runner rejects an artifact manifest that does not match the immutable image", async () => {
  const data = fixture({ executor: async () => ({ exitCode: 0, stdout: "safe", stderr: "" }) });
  try {
    const digest = "sha256:" + "a".repeat(64);
    const artifactManifest = createProductArtifactManifest({ projectId, releaseVersion: "1.0.0-test.1", sourceCommit: "a".repeat(40), artifact: "ghcr.io/example/product@sha256:" + "b".repeat(64), sbomDigest: digest, attestationDigest: digest, testEvidenceDigest: digest, createdAt: "2026-09-18T00:00:00.000Z" });
    const result = await data.runner.execute({ ...data.base, action: "start", runtimeSpec: { ...data.base.runtimeSpec, artifactManifest }, dispatchDecision: data.dispatch("test"), runtimeAuthorization: data.runtimeAuthorization("product-test-start") });
    assert.equal(result.status, "blocked");
    assert.equal(result.code, "PRODUCT_RUNNER_ADMISSION_REJECTED");
  } finally { cleanup(data); }
});

test("admission rejects host escape attempts before the executor is called", async () => {
  const calls = [];
  const data = fixture({ executor: async request => { calls.push(request); return { exitCode: 0 }; } });
  try {
    const result = await data.runner.execute({
      ...data.base,
      action: "test",
      runtimeSpec: { ...data.base.runtimeSpec, hostPaths: ["/var/run/docker.sock"] },
      dispatchDecision: data.dispatch("test"),
      runtimeAuthorization: data.runtimeAuthorization("product-test-test")
    });
    assert.equal(result.status, "blocked");
    assert.equal(result.code, "PRODUCT_RUNNER_ADMISSION_REJECTED");
    assert.equal(calls.length, 0);
  } finally { cleanup(data); }
});

test("workspace symlinks are rejected and executor failures expose no raw output", async () => {
  const data = fixture({ executor: async () => { throw new Error("secret provider output must not leak"); } });
  const link = path.join(data.root, "product-workspaces", projectId, "link-run");
  try {
    symlinkSync(path.join(data.root, data.base.runtimeSpec.workspaceKey), link, "dir");
    const symlinkInput = { ...data.base, action: "preflight", runtimeSpec: { ...data.base.runtimeSpec, workspaceKey: `product-workspaces/${projectId}/link-run` } };
    assert.equal(data.runner.preflight(symlinkInput).code, "PRODUCT_RUNNER_ADMISSION_REJECTED");
    const result = await data.runner.execute({
      ...data.base,
      action: "cleanup",
      runtimeAuthorization: data.runtimeAuthorization("product-test-cleanup")
    });
    assert.equal(result.status, "failed");
    assert.equal(result.code, "PRODUCT_RUNNER_EXECUTOR_FAILED");
    assert.equal(Object.hasOwn(result, "error"), false);
    assert.equal(Object.hasOwn(result.result.last, "message"), false);
    assert.equal(result.result.last.outputRedacted, true);
  } finally { cleanup(data); }
});

test("sensitive inputs are rejected while policy metadata remains allowed", async () => {
  const data = fixture();
  try {
    const result = await data.runner.execute({
      ...data.base,
      action: "build",
      apiKey: "sk-live-this-must-never-be-accepted",
      dispatchDecision: data.dispatch("develop"),
      runtimeAuthorization: data.runtimeAuthorization("product-test-build")
    });
    assert.equal(result.code, "PRODUCT_RUNNER_ADMISSION_REJECTED");
  } finally { cleanup(data); }
});

test("Docker executor is explicitly shell-free and returns process data only to the redacting runner", () => {
  const executor = createDockerProductExecutor();
  assert.equal(typeof executor, "function");
});

test("resource reservations prevent a second Product Test from reusing the same plan resources", async () => {
  const calls = [];
  const data = fixture();
  const secondWorkspace = path.join(data.root, "product-workspaces", projectId, "run-product-002");
  mkdirSync(secondWorkspace, { recursive: true });
  writeFileSync(path.join(secondWorkspace, "compose.yaml"), "services:\n  app:\n    image: " + artifact + "\n    build:\n      context: .\n      network: none\n    user: \"1000:1000\"\n    read_only: true\n    security_opt:\n      - no-new-privileges:true\n    cap_drop:\n      - ALL\n    cpus: 1\n    mem_limit: 1024m\n    pids_limit: 256\n    network_mode: none\n");
  const registry = createProductRuntimeReservationRegistry({ now: () => "2026-09-18T00:00:00.000Z" });
  const runner = createDockerProductRunner({ workspaceRoot: data.root, executor: async request => { calls.push(request); return { exitCode: 0, stdout: "safe", stderr: "" }; }, reservationRegistry: registry });
  try {
    const first = await runner.execute({ ...data.base, action: "start", dispatchDecision: data.dispatch("test"), runtimeAuthorization: data.runtimeAuthorization("product-test-start") });
    assert.equal(first.status, "completed");
    assert.equal(first.reservation.state, "held");
    const second = await runner.execute({ ...data.base, runId: "run-product-002", action: "start", runtimeSpec: { ...data.base.runtimeSpec, workspaceKey: `product-workspaces/${projectId}/run-product-002` }, dispatchDecision: { ...data.dispatch("test"), runId: "run-product-002" }, runtimeAuthorization: { ...data.runtimeAuthorization("product-test-start"), runId: "run-product-002" } });
    assert.equal(second.status, "blocked");
    assert.equal(second.code, "PRODUCT_RUNNER_RESOURCE_CONFLICT");
    assert.equal(registry.snapshot().reservations.length, 1);
    const stopped = await runner.execute({ ...data.base, action: "stop", runtimeAuthorization: data.runtimeAuthorization("product-test-stop") });
    assert.equal(stopped.status, "completed");
    assert.equal(registry.snapshot().reservations.length, 0);
    assert.equal(calls.length, 4);
  } finally { cleanup(data); }
});
