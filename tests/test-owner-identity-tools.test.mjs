import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { parseEnvironment, provisionTestOwnerIdentity } from "../tools/provision-test-owner-identity.mjs";
import { resolveSmokeBaseUrl } from "../tools/verify-test-owner-identity.mjs";

function temporaryRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hero-test-owner-identity-"));
  fs.mkdirSync(path.join(root, "var"), { mode: 0o700 });
  return root;
}

function writeAuthorization(root) {
  const authorization = {
    authorizationId: "BATCH-BACKOFFICE-20260911-020",
    status: "active",
    globalStop: false,
    grantedBy: "project-owner",
    operations: ["secret-change", "test-deploy"],
    excludedOperations: [],
    scope: { environment: "development-and-test", service: "hero-control-plane" },
    steps: ["BO-025", "BO-026", "BO-030"].map(stepId => ({ stepId, documentVersion: "1.0.0" }))
  };
  const file = path.join(root, "authorization.json");
  fs.writeFileSync(file, `${JSON.stringify(authorization)}\n`, { mode: 0o600 });
  return file;
}

function environment({ port = "43101" } = {}) {
  return [
    "HERO_HTTP_HOST=0.0.0.0",
    "HERO_HTTP_PORT=3100",
    "HERO_BIND_ADDRESS=127.0.0.1",
    `HERO_EXPOSE_PORT=${port}`,
    "HERO_DATA_DIR=/var/lib/hero",
    "HERO_REQUIRE_POSTGRES=true",
    "HERO_SECRET_STORE_ENABLED=true",
    "HERO_SECRET_STORE_DIR=/var/lib/hero/secret-store",
    "HERO_ENABLE_REAL_PROVIDERS=false",
    `HERO_OWNER_AUTH_SECRET=${"a".repeat(32)}`,
    "HERO_BACKOFFICE_USER=hero-test",
    `HERO_BACKOFFICE_PASSWORD=${"b".repeat(16)}`,
    `HERO_POSTGRES_PASSWORD=${"c".repeat(16)}`,
    `HERO_POSTGRES_URL=postgres://hero:${"c".repeat(16)}@hero-postgres:5432/hero`
  ].join("\n") + "\n";
}

test("Test owner provisioning proves the Test target, uses secure files and records no secret backup", () => {
  const root = temporaryRoot();
  try {
    const authorizationFile = writeAuthorization(root);
    const environmentFile = path.join(root, ".env");
    fs.writeFileSync(environmentFile, environment(), { mode: 0o600 });

    const result = provisionTestOwnerIdentity({ root, authorizationFile });
    const values = parseEnvironment(fs.readFileSync(environmentFile, "utf8"));
    assert.match(values.get("HERO_IDENTITY_SESSION_SECRET"), /^.{32,}$/);
    assert.match(values.get("HERO_MFA_ENCRYPTION_KEY"), /^[a-f0-9]{64}$/);
    assert.equal(values.get("HERO_OWNER_EMAIL"), "owner@hero.test");
    assert.match(values.get("HERO_OWNER_PASSWORD"), /^.{12,}$/);
    assert.match(values.get("HERO_OWNER_MFA_SECRET"), /^base32:[A-Z2-7]{16,}$/);
    assert.equal(fs.statSync(environmentFile).mode & 0o777, 0o600);

    const privateDirectory = path.join(root, "var/private");
    const bundle = path.join(root, result.accessBundle);
    const manifest = path.join(root, result.manifest);
    assert.equal(fs.statSync(privateDirectory).mode & 0o777, 0o700);
    assert.equal(fs.statSync(bundle).mode & 0o777, 0o600);
    assert.equal(fs.statSync(manifest).mode & 0o777, 0o600);
    const manifestText = fs.readFileSync(manifest, "utf8");
    assert.doesNotMatch(manifestText, new RegExp(values.get("HERO_OWNER_PASSWORD"), "u"));
    assert.deepEqual(fs.readdirSync(privateDirectory).filter(name => name.includes("env-before")), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("Test owner provisioning refuses a non-Test target before writing credentials", () => {
  const root = temporaryRoot();
  try {
    const authorizationFile = writeAuthorization(root);
    const environmentFile = path.join(root, ".env");
    const source = environment({ port: "43100" });
    fs.writeFileSync(environmentFile, source, { mode: 0o600 });

    assert.throws(() => provisionTestOwnerIdentity({ root, authorizationFile }), /HERO_EXPOSE_PORT باید 43101 باشد/u);
    assert.equal(fs.readFileSync(environmentFile, "utf8"), source);
    assert.equal(fs.existsSync(path.join(root, "var/private")), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("Test owner provisioning rejects a symlinked environment file", () => {
  const root = temporaryRoot();
  const externalDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "hero-test-owner-external-"));
  try {
    const authorizationFile = writeAuthorization(root);
    const externalEnv = path.join(externalDirectory, "outside.env");
    const source = environment();
    fs.writeFileSync(externalEnv, source, { mode: 0o600 });
    fs.symlinkSync(externalEnv, path.join(root, ".env"));

    assert.throws(() => provisionTestOwnerIdentity({ root, authorizationFile }), /must be a regular file/u);
    assert.equal(fs.readFileSync(externalEnv, "utf8"), source);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(externalDirectory, { recursive: true, force: true });
  }
});

test("Identity smoke accepts only canonical Hero Test origins", () => {
  assert.equal(resolveSmokeBaseUrl("http://127.0.0.1:3100"), "http://127.0.0.1:3100");
  assert.equal(resolveSmokeBaseUrl("https://test.hero.beeproject.ir/"), "https://test.hero.beeproject.ir");
  for (const invalid of [
    "https://example.test",
    "http://127.0.0.1:3100/other",
    "http://user:password@127.0.0.1:3100/",
    "http://127.0.0.1:3100/?redirect=https://example.test"
  ]) assert.throws(() => resolveSmokeBaseUrl(invalid), /not an approved Hero Test origin/u);
});
