import assert from "node:assert/strict";
import test from "node:test";

import { validateTestEnvironment } from "../tools/check-test-config.mjs";

const valid = {
  HERO_HTTP_HOST: "0.0.0.0",
  HERO_HTTP_PORT: "3100",
  HERO_BIND_ADDRESS: "127.0.0.1",
  HERO_EXPOSE_PORT: "43101",
  HERO_DATA_DIR: "/var/lib/hero",
  HERO_SECRET_STORE_ENABLED: "true",
  HERO_SECRET_STORE_DIR: "/var/lib/hero/secret-store",
  HERO_REQUIRE_POSTGRES: "true",
  HERO_ENABLE_REAL_PROVIDERS: "false",
  HERO_OWNER_AUTH_SECRET: "owner-secret-that-is-at-least-32-characters-long",
  HERO_IDENTITY_SESSION_SECRET: "identity-session-secret-that-is-at-least-32-chars",
  HERO_IDENTITY_OWNER_USER_ID: "hero-owner",
  HERO_OWNER_EMAIL: "owner@example.test",
  HERO_OWNER_DISPLAY_NAME: "Hero Owner",
  HERO_OWNER_PASSWORD: "Owner password 123",
  HERO_OWNER_MFA_SECRET: "base32:JBSWY3DPEHPK3PXP",
  HERO_OWNER_MFA_SECRET_REF: "env:HERO_OWNER_MFA_SECRET",
  HERO_BACKOFFICE_USER: "hero-admin",
  HERO_BACKOFFICE_PASSWORD: "test-backoffice-password-123",
  HERO_POSTGRES_URL: "postgresql://hero:test-postgres-password-123@hero-postgres:5432/hero",
  HERO_POSTGRES_PASSWORD: "test-postgres-password-123"
};

test("Test configuration preflight accepts isolated, provider-disabled settings", () => {
  assert.deepEqual(validateTestEnvironment(valid), { ok: true, errors: [] });
});

test("Test configuration preflight rejects placeholders and unsafe boundaries", () => {
  const result = validateTestEnvironment({ ...valid, HERO_EXPOSE_PORT: "43100", HERO_ENABLE_REAL_PROVIDERS: "true", HERO_OWNER_AUTH_SECRET: "<protected-secret>" });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /HERO_EXPOSE_PORT/);
  assert.match(result.errors.join("\n"), /HERO_ENABLE_REAL_PROVIDERS/);
  assert.match(result.errors.join("\n"), /HERO_OWNER_AUTH_SECRET/);
});

test("Test configuration preflight fails closed when human identity bootstrap values are absent", () => {
  const result = validateTestEnvironment({
    ...valid,
    HERO_IDENTITY_SESSION_SECRET: "",
    HERO_OWNER_EMAIL: "",
    HERO_OWNER_PASSWORD: "",
    HERO_OWNER_MFA_SECRET: ""
  });
  assert.equal(result.ok, false);
  for (const name of ["HERO_IDENTITY_SESSION_SECRET", "HERO_OWNER_EMAIL", "HERO_OWNER_PASSWORD", "HERO_OWNER_MFA_SECRET"]) {
    assert.match(result.errors.join("\n"), new RegExp(name));
  }
});

test("Test configuration preflight validates owner email, identifier and Base32 MFA shape without echoing values", () => {
  const result = validateTestEnvironment({
    ...valid,
    HERO_IDENTITY_OWNER_USER_ID: "invalid owner id",
    HERO_OWNER_EMAIL: "not-an-email",
    HERO_OWNER_MFA_SECRET: "base32:not-valid!"
  });
  assert.equal(result.ok, false);
  const errors = result.errors.join("\n");
  assert.match(errors, /HERO_IDENTITY_OWNER_USER_ID/);
  assert.match(errors, /HERO_OWNER_EMAIL/);
  assert.match(errors, /HERO_OWNER_MFA_SECRET/);
  assert.doesNotMatch(errors, /not-an-email|not-valid/);
});

test("Test configuration preflight rejects a PostgreSQL URL password mismatch", () => {
  const result = validateTestEnvironment({
    ...valid,
    HERO_POSTGRES_URL: "postgresql://hero:another-test-password-123@hero-postgres:5432/hero"
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /password داخل HERO_POSTGRES_URL باید با HERO_POSTGRES_PASSWORD یکسان باشد/);
  assert.doesNotMatch(result.errors.join("\n"), /test-postgres-password|another-test-password/);
});

test("Test configuration preflight fails closed when human identity is incomplete", () => {
  for (const name of ["HERO_IDENTITY_SESSION_SECRET", "HERO_OWNER_EMAIL", "HERO_OWNER_PASSWORD", "HERO_OWNER_MFA_SECRET"]) {
    const result = validateTestEnvironment({ ...valid, [name]: "" });
    assert.equal(result.ok, false, name);
    assert.match(result.errors.join("\n"), new RegExp(name), name);
  }
});

test("Test configuration preflight validates owner identity formats without echoing secrets", () => {
  const result = validateTestEnvironment({
    ...valid,
    HERO_IDENTITY_SESSION_SECRET: "short",
    HERO_IDENTITY_OWNER_USER_ID: "bad id",
    HERO_OWNER_EMAIL: "not-an-email",
    HERO_OWNER_PASSWORD: "short",
    HERO_OWNER_MFA_SECRET: "base32:not-valid!"
  });
  const errors = result.errors.join("\n");
  assert.equal(result.ok, false);
  for (const marker of ["HERO_IDENTITY_SESSION_SECRET", "HERO_IDENTITY_OWNER_USER_ID", "HERO_OWNER_EMAIL", "HERO_OWNER_PASSWORD", "HERO_OWNER_MFA_SECRET"]) assert.match(errors, new RegExp(marker));
  assert.doesNotMatch(errors, /not-valid|Owner password|identity-session-secret/);
});

test("Test configuration preflight keeps explicitly prefixed legacy MFA secrets compatible", () => {
  assert.deepEqual(validateTestEnvironment({ ...valid, HERO_OWNER_MFA_SECRET: "legacy-utf8:legacy-owner-secret" }), { ok: true, errors: [] });
  assert.deepEqual(validateTestEnvironment({ ...valid, HERO_OWNER_MFA_SECRET: "legacysecret" }), { ok: true, errors: [] });
});

test("Test configuration preflight validates the embedded Secret Store boundary without echoing its master key", () => {
  const invalid = validateTestEnvironment({ ...valid, HERO_SECRET_STORE_ENABLED: "false", HERO_SECRET_STORE_MASTER_KEY: "too-short" });
  assert.equal(invalid.ok, false);
  assert.match(invalid.errors.join("\n"), /HERO_SECRET_STORE_ENABLED|HERO_SECRET_STORE_MASTER_KEY/);
  assert.doesNotMatch(invalid.errors.join("\n"), /too-short/);
  const configured = validateTestEnvironment({ ...valid, HERO_SECRET_STORE_MASTER_KEY: "a".repeat(64) });
  assert.equal(configured.ok, true);
});

test("Test configuration preflight accepts a 32-byte MFA encryption key and rejects a weak one without echoing it", () => {
  assert.deepEqual(validateTestEnvironment({ ...valid, HERO_MFA_ENCRYPTION_KEY: "a".repeat(64) }), { ok: true, errors: [] });
  const weak = validateTestEnvironment({ ...valid, HERO_MFA_ENCRYPTION_KEY: "too-short-key" });
  assert.equal(weak.ok, false);
  assert.match(weak.errors.join("\n"), /HERO_MFA_ENCRYPTION_KEY/);
  assert.doesNotMatch(weak.errors.join("\n"), /too-short-key/);
});
