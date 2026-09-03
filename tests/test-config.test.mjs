import assert from "node:assert/strict";
import test from "node:test";

import { validateTestEnvironment } from "../tools/check-test-config.mjs";

const valid = {
  HERO_HTTP_HOST: "0.0.0.0",
  HERO_HTTP_PORT: "3100",
  HERO_BIND_ADDRESS: "127.0.0.1",
  HERO_EXPOSE_PORT: "43101",
  HERO_DATA_DIR: "/var/lib/hero",
  HERO_ENABLE_REAL_PROVIDERS: "false",
  HERO_OWNER_AUTH_SECRET: "owner-secret-that-is-at-least-32-characters-long",
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
