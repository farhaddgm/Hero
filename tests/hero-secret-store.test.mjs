import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { HeroSecretStoreError, createHeroSecretStore } from "../packages/adapters/src/hero-secret-store.mjs";

function temporaryRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "hero-secret-store-"));
}

test("embedded Test Secret Store encrypts values and exposes only safe metadata", () => {
  const root = temporaryRoot();
  try {
    const secret = "sk-test-" + crypto.randomBytes(18).toString("base64url");
    const store = createHeroSecretStore({ root });
    const saved = store.set({ providerId: "openai", value: secret });
    assert.deepEqual(Object.keys(saved).sort(), ["credentialRef", "environment", "providerId", "state", "updatedAt", "version"]);
    assert.equal(saved.credentialRef, "vault:hero/test/openai/default");
    assert.equal(saved.version, 1);
    assert.equal(store.get({ credentialRef: saved.credentialRef }), secret);
    assert.equal(store.has({ credentialRef: saved.credentialRef }), true);
    assert.equal(store.status({ credentialRef: saved.credentialRef }).configured, true);
    assert.equal(store.list().length, 1);
    const encrypted = fs.readFileSync(path.join(root, "test", "openai", "default.enc"), "utf8");
    assert.doesNotMatch(encrypted, new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "u"));
    assert.equal(fs.statSync(path.join(root, ".master-key")).mode & 0o777, 0o600);
    assert.equal(fs.statSync(path.join(root, "test", "openai", "default.enc")).mode & 0o777, 0o600);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("embedded Test Secret Store versions replacement and rejects unsafe references/values", () => {
  const root = temporaryRoot();
  try {
    const store = createHeroSecretStore({ root, masterKey: crypto.randomBytes(32) });
    const first = store.set({ providerId: "google", value: "google-secret-1" });
    const second = store.set({ credentialRef: first.credentialRef, value: "google-secret-2" });
    assert.equal(second.version, 2);
    assert.equal(store.get({ credentialRef: first.credentialRef }), "google-secret-2");
    for (const input of [
      { credentialRef: "vault:hero/production/openai/default", value: "valid-secret" },
      { credentialRef: "vault:hero/test/openai/../../outside", value: "valid-secret" },
      { providerId: "openai", value: "short" },
      { providerId: "openai", value: "invalid\nsecret" }
    ]) {
      assert.throws(() => store.set(input), error => error instanceof HeroSecretStoreError && ["SECRET_REFERENCE_INVALID", "SECRET_VALUE_INVALID"].includes(error.code));
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("embedded Test Secret Store refuses a symlinked root", () => {
  const parent = temporaryRoot();
  const target = temporaryRoot();
  try {
    const link = path.join(parent, "store");
    fs.symlinkSync(target, link, "dir");
    assert.throws(() => createHeroSecretStore({ root: link, masterKey: crypto.randomBytes(32) }), error => error instanceof HeroSecretStoreError && error.code === "SECRET_STORE_PATH_INVALID");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
    fs.rmSync(target, { recursive: true, force: true });
  }
});
