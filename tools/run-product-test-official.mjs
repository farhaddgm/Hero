import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import { createProductArtifactManifest, validateProductArtifactManifest } from "../packages/contracts/src/product-artifact.mjs";
import { createProductRuntimePlan } from "../packages/domain/src/product-factory.mjs";
import { createDockerProductExecutor, createDockerProductRunner } from "../packages/adapters/src/product-runner.mjs";
import { createProductRuntimeReservationRegistry } from "../packages/adapters/src/product-runtime-reservations.mjs";

const execFile = promisify(execFileCallback);
const ROOT = path.resolve(process.env.HERO_SOURCE_ROOT ?? process.cwd());
const AUTH_FILE = path.join(ROOT, "config/authorizations/product-test-20260918-001.json");
const AUTH_ID = "PRODUCT-TEST-20260918-001";
const STEP_ID = "PF3-PRODUCT-TEST-002";
const DOCUMENT_VERSION = "1.0.0";
const PROJECT_ID = "safe-sample";
const SOURCE_COMMIT = process.env.HERO_SOURCE_COMMIT ?? "";
const RUN_ID = process.env.HERO_PRODUCT_TEST_RUN_ID ?? `official-${Date.now()}`;
const WORKSPACE_ROOT = path.resolve(process.env.HERO_PRODUCT_WORKSPACE_ROOT ?? "/tmp/hero-product-official-root");
const WORKSPACE_ROOT_PREEXISTED = existsSync(WORKSPACE_ROOT);
const EVIDENCE_DIR = path.resolve(process.env.HERO_PRODUCT_EVIDENCE_DIR ?? `/tmp/hero-product-official-evidence-${RUN_ID}`);
const COMPOSE_PROJECT = `hero-product-safe-sample-${RUN_ID}`;
const WORKSPACE_KEY = `product-workspaces/${PROJECT_ID}/${RUN_ID}`;
const WORKSPACE = path.join(WORKSPACE_ROOT, WORKSPACE_KEY);
const COMPOSE_FILE = path.join(WORKSPACE, "compose.yaml");
const IMAGE_TAG = `hero-product-official-sample:${RUN_ID}`;
const TEST_COMMAND = ["/opt/product/test"];
const ID_PATTERN = /^[a-z][a-z0-9-]{2,127}$/;
const SHA_PATTERN = /^[a-f0-9]{40}$/;

function fail(message) { throw new Error(message); }
function hash(value) { return `sha256:${createHash("sha256").update(value).digest("hex")}`; }
function json(value) { return JSON.stringify(value, null, 2) + "\n"; }
function writeJson(file, value) { writeFileSync(file, json(value), { mode: 0o444 }); chmodSync(file, 0o444); }

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--")) fail(`unsupported argument: ${key}`);
    const name = key.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) fail(`${key} requires a value`);
    args[name] = value;
    index += 1;
  }
  return args;
}

async function docker(argv, { cwd = WORKSPACE, allowFailure = false } = {}) {
  try {
    return await execFile("docker", argv, {
      cwd,
      shell: false,
      timeout: 120_000,
      maxBuffer: 1_000_000,
      env: { PATH: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin" }
    });
  } catch (error) {
    if (allowFailure) return { stdout: error.stdout ?? "", stderr: error.stderr ?? "", code: error.code ?? 1 };
    const detail = String(error.stderr ?? "").replace(/(?:sk-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._-]{12,})/gi, "[REDACTED]").slice(0, 600);
    fail(`docker command failed (${argv.slice(0, 3).join(" ")}): ${detail}`);
  }
}

function authorization() {
  const record = JSON.parse(readFileSync(AUTH_FILE, "utf8"));
  const allowed = record.schema === "hero.authorization-snapshot/v1"
    && record.authorizationId === AUTH_ID
    && record.status === "active"
    && record.globalStop === false
    && record.scope?.environment === "test"
    && record.scope?.projectId === PROJECT_ID
    && record.scope?.production === false
    && record.scope?.pilot === false
    && record.scope?.secrets === false
    && record.scope?.liveProvider === false
    && record.scope?.externalSpend === false
    && record.steps?.some(item => item.stepId === STEP_ID && item.documentVersion === DOCUMENT_VERSION)
    && ["product-test-build", "product-test-test", "product-test-start", "product-test-stop", "product-test-cleanup"].every(operation => record.operations?.includes(operation));
  if (!allowed) fail("Product Test authorization does not match this Test-only official executor run.");
  return record;
}

function decision(operation) {
  return { authorized: true, code: "AUTHORIZED", globalStop: false, safeCheckpointRequired: false, projectId: PROJECT_ID, runId: RUN_ID, stepId: STEP_ID, documentVersion: DOCUMENT_VERSION, operation };
}

function runtimeAuthorization(operation) {
  return { authorizationId: AUTH_ID, ...decision(operation) };
}

function composeSource(image) {
  return `services:\n  sample:\n    image: ${image}\n    build:\n      context: .\n      dockerfile: Dockerfile\n      network: none\n    user: "65532:65532"\n    read_only: true\n    security_opt:\n      - no-new-privileges:true\n    cap_drop:\n      - ALL\n    cpus: 0.25\n    mem_limit: 128m\n    pids_limit: 64\n    network_mode: none\n    command: ["sleep", "3600"]\n    healthcheck:\n      test: ["CMD", "/bin/sh", "-c", "test -r /opt/product/READY"]\n      interval: 1s\n      timeout: 1s\n      retries: 10\n      start_period: 1s\n`;
}

function dockerfileSource() {
  return `FROM alpine:3.20\nRUN addgroup -S -g 65532 product && adduser -S -D -H -u 65532 -G product product\nRUN mkdir -p /opt/product && printf 'ready\\n' > /opt/product/READY && printf '#!/bin/sh\\nset -eu\\ntest -r /opt/product/READY\\n' > /opt/product/test && chmod 0555 /opt/product/test && chown -R 65532:65532 /opt/product\nUSER 65532:65532\n`;
}

function shellTestEvidence({ artifact, results, health, noImpact }) {
  return {
    schema: "hero.product-test-evidence/v1",
    authorizationId: AUTH_ID,
    stepId: STEP_ID,
    documentVersion: DOCUMENT_VERSION,
    runId: RUN_ID,
    composeProject: COMPOSE_PROJECT,
    sourceCommit: SOURCE_COMMIT,
    artifact,
    results,
    healthState: health,
    network: "none",
    secrets: false,
    liveProvider: false,
    externalSpend: false,
    production: false,
    pilot: false,
    heroNoImpact: noImpact
  };
}

function qualitySecurityEvidence({ artifact, results, health, compose }) {
  const checks = {
    immutableArtifact: /^hero-product-official-sample@sha256:[a-f0-9]{64}$/.test(artifact),
    boundedProductTest: results.test?.last?.exitCode === 0 && results.test?.last?.outputRedacted === true,
    healthyRuntime: health === "healthy",
    composeNetworkIsolation: /^\s+network_mode:\s+none\s*$/mi.test(compose),
    composeLeastPrivilege: /^\s+read_only:\s+true\s*$/mi.test(compose) && /no-new-privileges:true/i.test(compose) && /cap_drop:\n\s+-\s+ALL/i.test(compose),
    composeNoHostEscape: !/(?:network_mode:\s*host|privileged:\s*true|docker\.sock|^\s+volumes:\s*$)/mi.test(compose),
    noSensitiveValues: !/(?:sk-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._-]{12,}|BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY)/i.test(compose),
    redactedExecutionOutput: Object.values(results).filter(value => value?.last).every(value => value.last.outputRedacted === true)
  };
  if (Object.values(checks).some(value => value !== true)) fail(`quality/security gate failed: ${Object.entries(checks).filter(([, value]) => value !== true).map(([key]) => key).join(",")}`);
  return {
    schema: "hero.product-quality-security-evidence/v1",
    artifact,
    gates: checks,
    productQuality: { boundedTestCommand: "passed", healthReadiness: "passed", browserE2E: "not-applicable-safe-sample", dependencyScan: "not-applicable-safe-sample" },
    security: { composeIsolation: "passed", leastPrivilege: "passed", secretScan: "passed", sensitiveOutput: "redacted" },
    boundary: { environment: "test", production: false, pilot: false, secrets: false, liveProvider: false, externalSpend: false }
  };
}

async function heroState() {
  const names = ["hero-test-control-plane-1", "hero-production-control-plane-1"];
  const rows = [];
  for (const name of names) {
    const result = await docker(["inspect", "--format", "{{.Config.Image}}|{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}no-health{{end}}", name], { allowFailure: true });
    rows.push({ name, state: result.code ? "missing" : result.stdout.trim() });
  }
  return rows;
}

function assertNoImpact(before, after) {
  if (JSON.stringify(before) !== JSON.stringify(after)) fail("Hero Test/Production state changed during the official Product Test.");
}

async function run() {
  if (!ID_PATTERN.test(RUN_ID)) fail("run id is invalid.");
  if (!SHA_PATTERN.test(SOURCE_COMMIT)) fail("HERO_SOURCE_COMMIT must be a 40-character Git SHA.");
  authorization();
  if (existsSync(WORKSPACE)) fail("workspace collision: refusing to reuse an existing Product Test workspace.");
  if (existsSync(EVIDENCE_DIR)) fail("evidence directory collision: refusing to overwrite prior evidence.");
  if ((await docker(["image", "inspect", IMAGE_TAG], { cwd: ROOT, allowFailure: true })).code === 0) fail("image tag collision: refusing to overwrite an existing Product Test image.");
  mkdirSync(WORKSPACE, { recursive: true });
  mkdirSync(EVIDENCE_DIR, { recursive: false, mode: 0o755 });
  writeFileSync(path.join(WORKSPACE, "Dockerfile"), dockerfileSource(), { mode: 0o444 });
  writeFileSync(COMPOSE_FILE, composeSource(IMAGE_TAG), { mode: 0o444 });

  const beforeHero = await heroState();
  const plan = structuredClone(createProductRuntimePlan({ projectId: PROJECT_ID, riskLevel: "low" }));
  plan.state = "approved";
  plan.execution.mode = "isolated-test";
  plan.isolation.composeProject = COMPOSE_PROJECT;
  plan.isolation.database = `${COMPOSE_PROJECT}-db`;
  plan.isolation.volume = `${COMPOSE_PROJECT}-data`;
  plan.isolation.network = `${COMPOSE_PROJECT}-network`;
  const runtimeSpec = {
    workspaceKey: WORKSPACE_KEY,
    composeFile: "compose.yaml",
    serviceName: "sample",
    artifact: IMAGE_TAG,
    testCommand: TEST_COMMAND,
    resourceLimits: { cpuLimit: plan.resources.cpuLimit, memoryMiB: plan.resources.memoryMiB, pidsLimit: plan.resources.pidsLimit, timeoutSeconds: plan.execution.timeoutSeconds, maxConcurrentRuns: plan.execution.maxConcurrentRuns }
  };
  const reservationRegistry = createProductRuntimeReservationRegistry();
  const runner = createDockerProductRunner({ workspaceRoot: WORKSPACE_ROOT, executor: createDockerProductExecutor(), reservationRegistry });
  const results = {};

  async function action(action, spec = runtimeSpec, extra = {}) {
    const operation = `product-test-${action}`;
    const input = { projectId: PROJECT_ID, runId: RUN_ID, stepId: STEP_ID, documentVersion: DOCUMENT_VERSION, plan, runtimeSpec: spec, action, runtimeAuthorization: runtimeAuthorization(operation), ...extra };
    if (["build", "test", "start"].includes(action)) input.dispatchDecision = decision(action === "build" ? "develop" : "test");
    const result = await runner.execute(input);
    if (result.status !== "completed") fail(`${action} was not completed: ${result.code}`);
    results[action] = result.result;
    return result;
  }

  await action("build");
  const imageInspect = await docker(["image", "inspect", IMAGE_TAG, "--format", "{{.Id}}"]);
  const imageId = imageInspect.stdout.trim();
  if (!/^sha256:[a-f0-9]{64}$/.test(imageId)) fail("built image id is not an immutable digest.");
  const artifact = `hero-product-official-sample@${imageId}`;
  writeFileSync(COMPOSE_FILE, composeSource(artifact), { mode: 0o444 });
  const baseDigest = (await docker(["image", "inspect", "alpine:3.20", "--format", "{{.Id}}"])).stdout.trim();
  const sbom = { spdxVersion: "SPDX-2.3", name: "hero-product-official-safe-sample", artifact, baseImage: baseDigest, network: "none", secrets: false };
  const attestation = { _type: "https://in-toto.io/Statement/v1", subject: [{ name: artifact, digest: { sha256: imageId.slice("sha256:".length) } }], predicateType: "https://slsa.dev/provenance/v1", predicate: { sourceCommit: SOURCE_COMMIT, builder: "hero://product-runner/official-executor", network: "none" } };
  const sbomText = json(sbom);
  const attestationText = json(attestation);
  const sbomDigest = hash(sbomText);
  const attestationDigest = hash(attestationText);
  const effectiveSpec = { ...runtimeSpec, artifact };
  await action("test", effectiveSpec);
  await action("start", effectiveSpec);
  const composePsArgs = ["compose", "--project-name", COMPOSE_PROJECT, "--project-directory", WORKSPACE, "--file", COMPOSE_FILE, "ps", "-a", "--format", "json"];
  const composePs = await docker(composePsArgs, { allowFailure: true });
  const composeContainerId = (await docker(["compose", "--project-name", COMPOSE_PROJECT, "--project-directory", WORKSPACE, "--file", COMPOSE_FILE, "ps", "-q", "sample"], { allowFailure: true })).stdout.trim();
  const daemonContainerId = (await docker(["ps", "-aq", "--filter", `label=com.docker.compose.project=${COMPOSE_PROJECT}`, "--filter", "label=com.docker.compose.service=sample"], { allowFailure: true })).stdout.trim().split(/\s+/)[0] ?? "";
  const containerId = composeContainerId || daemonContainerId;
  if (!/^[a-f0-9]{12,64}$/.test(containerId)) fail(`official executor did not create the sample container; compose_state=${String(composePs.stdout ?? "").replace(/\s+/g, " ").slice(0, 800)}`);
  const inspection = JSON.parse((await docker(["inspect", containerId])).stdout)[0];
  if (inspection.Config.Image !== artifact || inspection.HostConfig.ReadonlyRootfs !== true || inspection.HostConfig.Privileged !== false || (inspection.HostConfig.Binds ?? []).length !== 0 || inspection.HostConfig.NetworkMode !== "none" || !(inspection.HostConfig.CapDrop ?? []).includes("ALL")) fail("official Product Test runtime isolation check failed.");
  let health = "starting";
  for (let attempt = 0; attempt < 30; attempt += 1) {
    health = (await docker(["inspect", "--format", "{{if .State.Health}}{{.State.Health.Status}}{{else}}no-health{{end}}", containerId])).stdout.trim();
    if (health === "healthy") break;
    await new Promise(resolve => setTimeout(resolve, 1_000));
  }
  if (health !== "healthy") fail("official Product Test health check did not become healthy.");
  results.health = { status: "completed", health, containerIdPrefix: containerId.slice(0, 12), immutable: true, isolated: true };
  await action("stop", effectiveSpec);
  await action("cleanup", effectiveSpec);
  const leftovers = (await docker(["ps", "-a", "--filter", `label=com.docker.compose.project=${COMPOSE_PROJECT}`, "--format", "{{.Names}}"])).stdout.trim();
  if (leftovers) fail("official Product Test cleanup left a container behind.");
  results.rollback = { status: "completed", sampleRuntime: "absent" };
  const afterHero = await heroState();
  assertNoImpact(beforeHero, afterHero);
  const testEvidence = shellTestEvidence({ artifact, results, health, noImpact: true });
  const testEvidenceText = json(testEvidence);
  const qualitySecurity = qualitySecurityEvidence({ artifact, results, health, compose: readFileSync(COMPOSE_FILE, "utf8") });
  const qualitySecurityText = json(qualitySecurity);
  const qualitySecurityDigest = hash(qualitySecurityText);
  const manifest = { ...createProductArtifactManifest({ projectId: PROJECT_ID, releaseVersion: "1.0.0-test.2", sourceCommit: SOURCE_COMMIT, artifact, sbomDigest, attestationDigest, testEvidenceDigest: hash(testEvidenceText) }), qualitySecurityEvidenceDigest: qualitySecurityDigest };
  const manifestErrors = validateProductArtifactManifest(manifest);
  if (manifestErrors.length) fail(`artifact manifest validation failed: ${manifestErrors.join(" ")}`);
  writeFileSync(path.join(EVIDENCE_DIR, "sbom.json"), sbomText, { mode: 0o444 });
  writeFileSync(path.join(EVIDENCE_DIR, "attestation.json"), attestationText, { mode: 0o444 });
  writeJson(path.join(EVIDENCE_DIR, "test-evidence.json"), testEvidence);
  writeJson(path.join(EVIDENCE_DIR, "quality-security-evidence.json"), qualitySecurity);
  writeJson(path.join(EVIDENCE_DIR, "hero-product-artifact-manifest.json"), manifest);
  writeJson(path.join(EVIDENCE_DIR, "hero-state-before-after.json"), { before: beforeHero, after: afterHero, unchanged: true });
  // Keep the final local tag as the host-side retention reference for the
  // immutable image digest. Removing the only local tag would delete the
  // image itself when the daemon has no registry RepoDigest entry.
  rmSync(WORKSPACE, { recursive: true, force: true });
  if (!WORKSPACE_ROOT_PREEXISTED) rmSync(WORKSPACE_ROOT, { recursive: true, force: true });
  process.stdout.write(json({ status: "success", authorizationId: AUTH_ID, stepId: STEP_ID, documentVersion: DOCUMENT_VERSION, runId: RUN_ID, composeProject: COMPOSE_PROJECT, artifact, health, results: Object.fromEntries(Object.entries(results).map(([key, value]) => [key, value?.status ?? "passed"])), heroNoImpact: true, evidenceDir: EVIDENCE_DIR, artifactManifest: path.join(EVIDENCE_DIR, "hero-product-artifact-manifest.json") }));
}

run().catch(async error => {
  await docker(["compose", "--project-name", COMPOSE_PROJECT, "--project-directory", WORKSPACE, "--file", COMPOSE_FILE, "down", "--remove-orphans"], { cwd: ROOT, allowFailure: true });
  await docker(["image", "rm", "--force", IMAGE_TAG], { cwd: ROOT, allowFailure: true });
  rmSync(WORKSPACE, { recursive: true, force: true });
  if (!WORKSPACE_ROOT_PREEXISTED) rmSync(WORKSPACE_ROOT, { recursive: true, force: true });
  process.stderr.write(`OFFICIAL PRODUCT TEST: FAIL — ${String(error.message ?? error).replace(/(?:sk-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._-]{12,})/gi, "[REDACTED]").slice(0, 1_000)}\n`);
  process.exitCode = 1;
});
