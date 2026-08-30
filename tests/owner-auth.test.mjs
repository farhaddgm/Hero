import assert from "node:assert/strict";
import test from "node:test";

import { validateOwnerAuthContract } from "../packages/contracts/src/owner-auth.mjs";
import { OwnerAuthError, createOwnerAuth } from "../packages/domain/src/owner-auth.mjs";

const secret = "test-only-owner-auth-secret-1234567890";

test("owner authentication issues and validates signed project-owner sessions", () => {
  assert.deepEqual(validateOwnerAuthContract(), []);
  const auth = createOwnerAuth({ secret, now: () => "2026-08-30T12:00:00.000Z" });
  const token = auth.issueSession({ subject: "hero-owner", sessionId: "session-001", expiresAt: 2000000000 });
  assert.equal(auth.configured, true);
  assert.equal(token.includes(secret), false);
  assert.deepEqual(auth.authenticate(`Bearer ${token}`), {
    subject: "hero-owner",
    sessionId: "session-001",
    role: "project-owner",
    expiresAt: 2000000000,
    decision: "OWNER_AUTHENTICATED"
  });
});

test("owner authentication fails closed for missing, tampered and expired sessions", () => {
  const auth = createOwnerAuth({ secret, now: () => "2026-08-30T12:00:00.000Z" });
  const token = auth.issueSession({ subject: "hero-owner", sessionId: "session-002", expiresAt: 2000000000 });
  assert.throws(() => auth.requireOwner(), error => error instanceof OwnerAuthError && error.code === "OWNER_AUTH_REQUIRED");
  assert.throws(() => auth.requireOwner(`Bearer ${token.slice(0, -1)}x`), error => error.code === "OWNER_AUTH_INVALID");

  const expired = createOwnerAuth({ secret, now: () => "2034-01-01T00:00:00.000Z" });
  assert.throws(() => expired.requireOwner(`Bearer ${token}`), error => error.code === "OWNER_AUTH_EXPIRED");
});

test("owner authentication has no usable default secret", () => {
  const auth = createOwnerAuth({ now: () => "2026-08-30T12:00:00.000Z" });
  assert.equal(auth.configured, false);
  assert.throws(
    () => auth.issueSession({ subject: "hero-owner" }),
    error => error instanceof OwnerAuthError && error.code === "OWNER_AUTH_NOT_CONFIGURED" && error.statusCode === 503
  );
});
