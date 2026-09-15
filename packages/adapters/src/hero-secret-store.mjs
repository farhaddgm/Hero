import crypto from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import path from "node:path";

const PROVIDER_ID = /^[a-z][a-z0-9-]{2,63}$/;
const ENVIRONMENT_ID = /^(?:test)$/;
const SECRET_ID = /^[a-z][a-z0-9._:-]{2,127}$/;
const REF = /^vault:hero\/(test)\/([a-z][a-z0-9-]{2,63})\/([a-z][a-z0-9._:-]{2,127})$/;
const KEY_BYTES = 32;
const FILE_MODE = 0o600;
const DIRECTORY_MODE = 0o700;
const MAX_SECRET_BYTES = 16 * 1024;
const ENVELOPE_VERSION = "hero-secret-v1";

export class HeroSecretStoreError extends Error {
  constructor(code, message, status = 500) {
    super(message);
    this.name = "HeroSecretStoreError";
    this.code = code;
    this.status = status;
  }
}

function assertAbsoluteRoot(root) {
  if (typeof root !== "string" || !path.isAbsolute(root)) {
    throw new HeroSecretStoreError("SECRET_STORE_ROOT_INVALID", "Secret Store root must be an absolute path.", 500);
  }
  return path.resolve(root);
}

function assertRegularDirectory(target, code) {
  try {
    const stat = lstatSync(target);
    if (!stat.isDirectory()) throw new HeroSecretStoreError(code, "Secret Store path must be a directory.", 500);
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    if (error instanceof HeroSecretStoreError) throw error;
    throw new HeroSecretStoreError(code, "Secret Store path could not be inspected.", 500);
  }
  return true;
}

function ensureDirectory(target) {
  if (existsSync(target)) {
    if (!assertRegularDirectory(target, "SECRET_STORE_PATH_INVALID")) throw new HeroSecretStoreError("SECRET_STORE_PATH_INVALID", "Secret Store path is invalid.", 500);
    return;
  }
  mkdirSync(target, { recursive: true, mode: DIRECTORY_MODE });
  const stat = lstatSync(target);
  if (!stat.isDirectory()) throw new HeroSecretStoreError("SECRET_STORE_PATH_INVALID", "Secret Store root is not a directory.", 500);
}

function validateFilePath(target, code = "SECRET_STORE_FILE_INVALID") {
  try {
    const stat = lstatSync(target);
    if (!stat.isFile()) throw new HeroSecretStoreError(code, "Secret Store file is not a regular file.", 500);
    return stat;
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    if (error instanceof HeroSecretStoreError) throw error;
    throw new HeroSecretStoreError(code, "Secret Store file could not be inspected.", 500);
  }
}

function fsyncFile(target) {
  const descriptor = openSync(target, "r");
  try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
}

function fsyncDirectory(target) {
  const descriptor = openSync(target, "r");
  try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
}

function atomicWrite(target, bytes) {
  const directory = path.dirname(target);
  const temporary = path.join(directory, `.${path.basename(target)}.${crypto.randomUUID()}.tmp`);
  try {
    writeFileSync(temporary, bytes, { encoding: "utf8", mode: FILE_MODE, flag: "wx" });
    fsyncFile(temporary);
    renameSync(temporary, target);
    fsyncDirectory(directory);
    const stat = statSync(target);
    if (!stat.isFile() || stat.size !== Buffer.byteLength(bytes, "utf8")) {
      throw new HeroSecretStoreError("SECRET_STORE_WRITE_INCOMPLETE", "Secret Store write was incomplete.", 500);
    }
  } finally {
    try { unlinkSync(temporary); } catch { /* rename completed or write failed */ }
  }
}

function encode(value) { return Buffer.from(value, "utf8").toString("base64url"); }
function decode(value) { return Buffer.from(value, "base64url").toString("utf8"); }

function normalizeSecretValue(value) {
  if (typeof value !== "string" || value.length < 8 || value.length > MAX_SECRET_BYTES) {
    throw new HeroSecretStoreError("SECRET_VALUE_INVALID", "Secret must be between 8 and 16384 characters.", 400);
  }
  if (/[\u0000-\u001f\u007f\r\n]/u.test(value)) {
    throw new HeroSecretStoreError("SECRET_VALUE_INVALID", "Secret must not contain control characters or line breaks.", 400);
  }
  return value;
}

function normalizeReference({ credentialRef, environment = "test", providerId, secretId = "default" } = {}) {
  if (typeof credentialRef === "string" && credentialRef.trim()) {
    const match = credentialRef.trim().match(REF);
    if (!match) throw new HeroSecretStoreError("SECRET_REFERENCE_INVALID", "Only a Hero Test vault reference is accepted.", 400);
    return Object.freeze({ credentialRef: credentialRef.trim(), environment: match[1], providerId: match[2], secretId: match[3] });
  }
  if (environment !== "test" || !ENVIRONMENT_ID.test(environment)) throw new HeroSecretStoreError("SECRET_ENVIRONMENT_INVALID", "Only the Test environment can use the embedded Secret Store.", 400);
  if (typeof providerId !== "string" || !PROVIDER_ID.test(providerId)) throw new HeroSecretStoreError("SECRET_PROVIDER_INVALID", "Provider ID is invalid.", 400);
  if (typeof secretId !== "string" || !SECRET_ID.test(secretId)) throw new HeroSecretStoreError("SECRET_ID_INVALID", "Secret ID is invalid.", 400);
  return Object.freeze({ credentialRef: `vault:hero/test/${providerId}/${secretId}`, environment, providerId, secretId });
}

function deriveKey(masterKey) {
  if (Buffer.isBuffer(masterKey) && masterKey.length === KEY_BYTES) return Buffer.from(masterKey);
  if (typeof masterKey === "string" && masterKey.length > 0) {
    const trimmed = masterKey.trim();
    if (/^[a-f0-9]{64}$/i.test(trimmed)) return Buffer.from(trimmed, "hex");
    if (/^[A-Za-z0-9_-]{43}$/u.test(trimmed)) return Buffer.from(trimmed, "base64url");
  }
  throw new HeroSecretStoreError("SECRET_STORE_MASTER_KEY_INVALID", "Secret Store master key must be 32 bytes.", 500);
}

function loadOrCreateMasterKey(root, configuredMasterKey) {
  if (configuredMasterKey !== undefined && configuredMasterKey !== null && String(configuredMasterKey).trim() !== "") return deriveKey(configuredMasterKey);
  const target = path.join(root, ".master-key");
  const existing = validateFilePath(target, "SECRET_STORE_MASTER_KEY_FILE_INVALID");
  if (existing) {
    if (existing.size !== KEY_BYTES) throw new HeroSecretStoreError("SECRET_STORE_MASTER_KEY_FILE_INVALID", "Secret Store master key file has an invalid size.", 500);
    return Buffer.from(readFileSync(target));
  }
  const key = crypto.randomBytes(KEY_BYTES);
  // Create the master key with an exclusive descriptor. A temp-file followed
  // by rename is not sufficient here because POSIX rename replaces an
  // existing file, so two control-plane starts could otherwise rotate the
  // key in a race and make all encrypted records unreadable.
  try {
    const descriptor = openSync(target, "wx", FILE_MODE);
    try {
      writeFileSync(descriptor, key);
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
    fsyncDirectory(root);
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
  }
  const stored = validateFilePath(target, "SECRET_STORE_MASTER_KEY_FILE_INVALID");
  if (!stored || stored.size !== KEY_BYTES) throw new HeroSecretStoreError("SECRET_STORE_MASTER_KEY_FILE_INVALID", "Secret Store master key could not be initialized.", 500);
  return Buffer.from(readFileSync(target));
}

function encrypt(value, key, associatedData) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(associatedData, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [ENVELOPE_VERSION, encode(iv.toString("base64")), encode(cipher.getAuthTag().toString("base64")), encode(ciphertext.toString("base64"))].join(".");
}

function decrypt(envelope, key, associatedData) {
  const parts = String(envelope).trim().split(".");
  if (parts.length !== 4 || parts[0] !== ENVELOPE_VERSION) throw new HeroSecretStoreError("SECRET_ENVELOPE_INVALID", "Secret Store envelope is invalid.", 500);
  try {
    const iv = Buffer.from(decode(parts[1]), "base64");
    const tag = Buffer.from(decode(parts[2]), "base64");
    const ciphertext = Buffer.from(decode(parts[3]), "base64");
    if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) throw new Error("invalid envelope lengths");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(Buffer.from(associatedData, "utf8"));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    throw new HeroSecretStoreError("SECRET_DECRYPT_FAILED", "Secret Store could not decrypt the credential.", 500);
  }
}

/**
 * Test-only encrypted Secret Store. The control plane receives a credential
 * once, encrypts it with AES-256-GCM and returns only a reference/status. Raw
 * values never enter the event log, PostgreSQL projections, browser response
 * or logs. Production must use an external Secret Manager instead.
 */
export function createHeroSecretStore({ root, masterKey, now = () => new Date().toISOString(), enabled = true, environment = "test" } = {}) {
  if (!enabled) return null;
  const rootPath = assertAbsoluteRoot(root);
  if (environment !== "test") throw new HeroSecretStoreError("SECRET_STORE_ENVIRONMENT_UNSUPPORTED", "The embedded Secret Store is Test-only.", 500);
  ensureDirectory(rootPath);
  const key = loadOrCreateMasterKey(rootPath, masterKey);
  const targetFor = reference => {
    const parsed = normalizeReference({ credentialRef: reference });
    const relative = path.join(parsed.environment, parsed.providerId, `${parsed.secretId}.enc`);
    const target = path.resolve(rootPath, relative);
    if (!target.startsWith(`${rootPath}${path.sep}`)) throw new HeroSecretStoreError("SECRET_STORE_PATH_ESCAPE", "Secret Store reference escaped the configured root.", 500);
    ensureDirectory(path.dirname(target));
    return { parsed, target };
  };
  const readRecord = reference => {
    const { parsed, target } = targetFor(reference);
    const stat = validateFilePath(target);
    if (!stat) return null;
    const value = decrypt(readFileSync(target, "utf8"), key, parsed.credentialRef);
    let record;
    try { record = JSON.parse(value); } catch { throw new HeroSecretStoreError("SECRET_RECORD_INVALID", "Secret Store record is invalid.", 500); }
    if (record?.credentialRef !== parsed.credentialRef || record?.providerId !== parsed.providerId || record?.environment !== parsed.environment || typeof record?.secret !== "string") {
      throw new HeroSecretStoreError("SECRET_RECORD_INVALID", "Secret Store record does not match its reference.", 500);
    }
    return Object.freeze({ ...parsed, secret: record.secret, version: Number.isInteger(record.version) ? record.version : 1, updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : null });
  };
  return Object.freeze({
    enabled: true,
    environment,
    set({ providerId, secretId = "default", credentialRef, value } = {}) {
      const parsed = normalizeReference({ providerId, secretId, credentialRef });
      const secret = normalizeSecretValue(value);
      const { target } = targetFor(parsed.credentialRef);
      const prior = readRecord(parsed.credentialRef);
      const record = { credentialRef: parsed.credentialRef, providerId: parsed.providerId, environment: parsed.environment, secret, version: (prior?.version ?? 0) + 1, updatedAt: now() };
      atomicWrite(target, encrypt(JSON.stringify(record), key, parsed.credentialRef));
      return Object.freeze({ credentialRef: parsed.credentialRef, providerId: parsed.providerId, environment: parsed.environment, state: "configured", version: record.version, updatedAt: record.updatedAt });
    },
    get({ credentialRef } = {}) {
      const parsed = normalizeReference({ credentialRef });
      const record = readRecord(parsed.credentialRef);
      if (!record) throw new HeroSecretStoreError("SECRET_NOT_CONFIGURED", "The provider credential is not configured in the Test Secret Store.", 503);
      return record.secret;
    },
    has({ credentialRef } = {}) {
      const parsed = normalizeReference({ credentialRef });
      return Boolean(readRecord(parsed.credentialRef));
    },
    status({ credentialRef, providerId, secretId = "default" } = {}) {
      const parsed = normalizeReference({ credentialRef, providerId, secretId });
      const record = readRecord(parsed.credentialRef);
      return Object.freeze({ credentialRef: parsed.credentialRef, providerId: parsed.providerId, environment: parsed.environment, configured: Boolean(record), state: record ? "configured" : "not-configured", version: record?.version ?? null, updatedAt: record?.updatedAt ?? null });
    },
    list() {
      const rows = [];
      const environments = readdirSync(rootPath, { withFileTypes: true });
      for (const environmentEntry of environments) {
        if (!environmentEntry.isDirectory() || environmentEntry.name.startsWith(".")) continue;
        const environmentPath = path.join(rootPath, environmentEntry.name);
        if (!assertRegularDirectory(environmentPath, "SECRET_STORE_PATH_INVALID")) continue;
        for (const providerEntry of readdirSync(environmentPath, { withFileTypes: true })) {
          if (!providerEntry.isDirectory() || providerEntry.name.startsWith(".")) continue;
          const providerPath = path.join(environmentPath, providerEntry.name);
          if (!assertRegularDirectory(providerPath, "SECRET_STORE_PATH_INVALID")) continue;
          for (const fileEntry of readdirSync(providerPath, { withFileTypes: true })) {
            if (!fileEntry.isFile() || !fileEntry.name.endsWith(".enc")) continue;
            const secretId = fileEntry.name.slice(0, -4);
            if (!ENVIRONMENT_ID.test(environmentEntry.name) || !PROVIDER_ID.test(providerEntry.name) || !SECRET_ID.test(secretId)) continue;
            const reference = `vault:hero/${environmentEntry.name}/${providerEntry.name}/${secretId}`;
            const record = readRecord(reference);
            if (record) rows.push(Object.freeze({ credentialRef: reference, providerId: providerEntry.name, environment: environmentEntry.name, state: "configured", version: record.version, updatedAt: record.updatedAt }));
          }
        }
      }
      return Object.freeze(rows.sort((left, right) => left.credentialRef.localeCompare(right.credentialRef)));
    }
  });
}
