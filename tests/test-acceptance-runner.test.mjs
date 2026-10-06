// Keeps tools/acceptance/run-test-acceptance.mjs in step with the API: the seed
// phase must pass against a fresh server. The full seed → kill → verify cycle
// with PostgreSQL runs on the Test host via tools/run-test-acceptance.sh.
import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

test("acceptance runner seed phase passes against a fresh server", { timeout: 120000 }, async t => {
  const state = mkdtempSync(path.join(os.tmpdir(), "hero-acceptance-test-"));
  t.after(() => rmSync(state, { recursive: true, force: true }));
  const port = 43000 + crypto.randomInt(900);
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const owner = { HERO_OWNER_EMAIL: "owner@acceptance.invalid", HERO_OWNER_PASSWORD: crypto.randomBytes(16).toString("hex"), HERO_OWNER_MFA_SECRET: [...crypto.randomBytes(32)].map(byte => alphabet[byte % 32]).join("") };
  const env = { ...process.env, ...owner, HERO_IDENTITY_SESSION_SECRET: crypto.randomBytes(32).toString("hex"), HERO_HTTP_HOST: "127.0.0.1", HERO_HTTP_PORT: String(port), HERO_DATA_DIR: state, HERO_POSTGRES_URL: "", HERO_REQUIRE_POSTGRES: "false" };
  const server = spawn(process.execPath, ["apps/control-plane/src/server.mjs"], { cwd: root, env, stdio: "ignore" });
  t.after(() => server.kill("SIGKILL"));
  const base = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 100; attempt += 1) { try { if ((await fetch(`${base}/health`)).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 100)); }
  const runner = spawn(process.execPath, ["tools/acceptance/run-test-acceptance.mjs", "seed"], { cwd: root, env: { ...process.env, ...owner, HERO_ACCEPTANCE_BASE_URL: base, HERO_ACCEPTANCE_STATE_DIR: state, HERO_ACCEPTANCE_IDENTITY_MODULE: path.join(root, "packages/domain/src/human-identity.mjs") }, stdio: ["ignore", "pipe", "pipe"] });
  let output = ""; runner.stdout.on("data", chunk => { output += chunk; }); runner.stderr.on("data", chunk => { output += chunk; });
  const code = await new Promise(resolve => runner.on("exit", resolve));
  assert.equal(code, 0, output);
  const checks = JSON.parse(readFileSync(path.join(state, "checks-seed.json"), "utf8"));
  assert.ok(checks.length >= 50 && checks.every(item => item.ok), output);
  assert.ok(!readFileSync(path.join(state, "checks-seed.json"), "utf8").includes(owner.HERO_OWNER_PASSWORD), "results never contain credentials");
});
