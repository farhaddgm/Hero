import assert from "node:assert/strict";
import test from "node:test";

import { createHumanIdentity } from "../packages/domain/src/human-identity.mjs";
import { createMfaVault, MfaVaultError } from "../packages/domain/src/mfa-vault.mjs";
import { createProjectAccessRegistry } from "../packages/domain/src/project-access.mjs";

const keyA = "a".repeat(64); const keyB = "b".repeat(64);
const now = () => "2026-10-08T12:00:00.000Z";
const actor = { role: "project-owner", subject: "hero-owner" };
function build(vault) {
  const access = createProjectAccessRegistry({ ownerUserId: "hero-owner", ownerUser: { email: "owner@example.test", displayName: "Owner" }, now });
  return createHumanIdentity({ accessRegistry: access, sessionSecret: "rotation-session-secret-123456789012345678", now, mfaVault: vault, owner: { userId: "hero-owner", email: "owner@example.test", displayName: "Owner", password: "Owner password 123", mfaSecret: "owner-mfa-secret-for-rotation" } });
}

test("a secret sealed with the previous key still opens, and is sealed again with the current key", () => {
  const first = build(createMfaVault({ key: keyA }));
  first.createUser({ actor, user: { userId: "rot-user", email: "rot@example.test", displayName: "Rot", password: "Rotation password 123", mfaSecret: "rotation-user-secret-1", mfaRequired: true } });
  const record = first.persistenceRecord({ userId: "rot-user" });
  assert.match(record.mfaSecretCipher, /^mfa1\.[a-f0-9]{8}\./);
  assert.equal(record.mfaSecretCipher.includes("rotation-user-secret-1"), false);

  const vaultB = createMfaVault({ key: keyB, previousKeys: keyA });
  assert.equal(vaultB.needsRotation(record.mfaSecretCipher), true);
  const second = build(vaultB);
  second.hydrateUser({ user: record });
  assert.equal(second.getUser("rot-user").mfaState, "ready");
  const resealed = second.persistenceRecord({ userId: "rot-user" });
  assert.equal(vaultB.needsRotation(resealed.mfaSecretCipher), false);
  assert.notEqual(resealed.mfaSecretCipher, record.mfaSecretCipher);

  // After rotation the previous key is no longer needed.
  const third = build(createMfaVault({ key: keyB }));
  third.hydrateUser({ user: resealed });
  assert.equal(third.getUser("rot-user").mfaState, "ready");
});

test("without the previous key the old secret reports key-unavailable instead of passing, and a sealed value cannot move to another account", () => {
  const first = build(createMfaVault({ key: keyA }));
  first.createUser({ actor, user: { userId: "rot-user", email: "rot@example.test", displayName: "Rot", password: "Rotation password 123", mfaSecret: "rotation-user-secret-1", mfaRequired: true } });
  const record = first.persistenceRecord({ userId: "rot-user" });
  const lost = build(createMfaVault({ key: keyB }));
  lost.hydrateUser({ user: record });
  assert.equal(lost.getUser("rot-user").mfaState, "key-unavailable");
  const vaultA = createMfaVault({ key: keyA });
  assert.throws(() => vaultA.open("other-user", record.mfaSecretCipher), error => error instanceof MfaVaultError);
  assert.throws(() => createMfaVault({ key: "short" }), error => error.code === "MFA_KEY_INVALID");
});
