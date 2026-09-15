import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateTestEnvironment } from "./check-test-config.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AUTHORIZATION_FILE = path.join(ROOT, "config/authorizations/backoffice-20260911-020.json");
const REQUIRED_STEPS = Object.freeze(["BO-025", "BO-026", "BO-030"]);
const REQUIRED_OPERATIONS = Object.freeze(["secret-change", "test-deploy"]);
const OWNER_EMAIL_FALLBACK = "owner@hero.test";

function fail(message) {
  throw new Error(message);
}

function decodeEnvValue(raw) {
  const value = raw.trim();
  if (value.startsWith('"') && value.endsWith('"')) {
    try { return JSON.parse(value); } catch { fail("A quoted environment value is invalid."); }
  }
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1);
  return value;
}

function encodeEnvValue(value) {
  const string = String(value);
  return /^[A-Za-z0-9_./:@+-]+$/.test(string) ? string : JSON.stringify(string);
}

export function parseEnvironment(source) {
  const values = new Map();
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match && !values.has(match[1])) values.set(match[1], decodeEnvValue(match[2]));
  }
  return values;
}

export function updateEnvironment(source, updates) {
  const written = new Set();
  const output = [];
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=/);
    if (!match || !updates.has(match[1])) {
      output.push(line);
      continue;
    }
    if (!written.has(match[1])) output.push(`${match[1]}=${encodeEnvValue(updates.get(match[1]))}`);
    written.add(match[1]);
  }
  for (const [name, value] of updates) {
    if (!written.has(name)) output.push(`${name}=${encodeEnvValue(value)}`);
  }
  return `${output.join("\n").replace(/\n+$/, "")}\n`;
}

function base32(buffer) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}

function canonicalBase32(secret) {
  const value = String(secret ?? "").trim();
  if (!/^base32:/i.test(value)) return null;
  const normalized = value.slice(value.indexOf(":") + 1).replace(/[\s-]/g, "").replace(/=+$/g, "").toUpperCase();
  if (normalized.length < 16 || !/^[A-Z2-7]+$/.test(normalized)) fail("Existing HERO_OWNER_MFA_SECRET is not valid Base32; it was not changed.");
  return normalized;
}

function assertRegularFile(file, label) {
  let stats;
  try { stats = fs.lstatSync(file); } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
  if (stats.isSymbolicLink() || !stats.isFile()) fail(`${label} must be a regular file and must not be a symlink.`);
  return true;
}

function assertDirectory(directory, label, { create = false } = {}) {
  let stats;
  try { stats = fs.lstatSync(directory); } catch (error) {
    if (error?.code !== "ENOENT" || !create) throw error;
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    stats = fs.lstatSync(directory);
  }
  if (stats.isSymbolicLink() || !stats.isDirectory()) fail(`${label} must be a directory and must not be a symlink.`);
  return directory;
}

function syncDirectory(directory) {
  const descriptor = fs.openSync(directory, "r");
  try { fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
}

function writeNewFile(file, content) {
  const descriptor = fs.openSync(file, "wx", 0o600);
  try {
    fs.writeFileSync(descriptor, content, "utf8");
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  fs.chmodSync(file, 0o600);
}

function temporaryPath(directory, label) {
  return path.join(directory, `.${label}-${crypto.randomUUID()}.tmp`);
}

function writeAtomically(file, content, label) {
  const directory = path.dirname(file);
  assertDirectory(directory, `${label} directory`);
  assertRegularFile(file, label);
  const temporary = temporaryPath(directory, label.replace(/[^A-Za-z0-9]/g, "-"));
  try {
    writeNewFile(temporary, content);
    fs.renameSync(temporary, file);
    fs.chmodSync(file, 0o600);
    syncDirectory(directory);
  } finally {
    if (assertRegularFile(temporary, `${label} temporary`)) fs.unlinkSync(temporary);
  }
}

function validateAuthorization(authorizationFile) {
  assertRegularFile(authorizationFile, "Authorization snapshot");
  const authorization = JSON.parse(fs.readFileSync(authorizationFile, "utf8"));
  if (authorization.authorizationId !== "BATCH-BACKOFFICE-20260911-020") fail("The authorization snapshot ID is stale.");
  if (authorization.status !== "active" || authorization.globalStop !== false || authorization.grantedBy !== "project-owner") fail("The authorization snapshot is not dispatchable.");
  for (const operation of REQUIRED_OPERATIONS) {
    if (!authorization.operations?.includes(operation) || authorization.excludedOperations?.includes(operation)) fail(`Authorization does not grant ${operation}.`);
  }
  for (const stepId of REQUIRED_STEPS) {
    const step = authorization.steps?.find(item => item.stepId === stepId);
    if (!step || step.documentVersion !== "1.0.0") fail(`Authorization does not match ${stepId}@1.0.0.`);
  }
  if (authorization.scope?.environment !== "development-and-test" || authorization.scope?.service !== "hero-control-plane") fail("Authorization scope does not match Hero Test.");
}

function validateProspectiveEnvironment(values) {
  const candidate = Object.fromEntries(values);
  const result = validateTestEnvironment(candidate);
  if (!result.ok) fail(`Test target validation failed: ${result.errors.join(" ")}`);
}

function buildUpdates(current) {
  const ownerEmail = current.get("HERO_OWNER_EMAIL") || OWNER_EMAIL_FALLBACK;
  const ownerPassword = current.get("HERO_OWNER_PASSWORD") || crypto.randomBytes(32).toString("base64url");
  const existingMfa = current.get("HERO_OWNER_MFA_SECRET");
  const mfaBase32 = existingMfa ? canonicalBase32(existingMfa) : base32(crypto.randomBytes(20));
  return new Map([
    ["HERO_SECRET_STORE_ENABLED", current.get("HERO_SECRET_STORE_ENABLED") || "true"],
    ["HERO_SECRET_STORE_DIR", current.get("HERO_SECRET_STORE_DIR") || "/var/lib/hero/secret-store"],
    ["HERO_SECRET_STORE_MASTER_KEY", current.get("HERO_SECRET_STORE_MASTER_KEY") || ""],
    ["HERO_IDENTITY_SESSION_SECRET", current.get("HERO_IDENTITY_SESSION_SECRET") || crypto.randomBytes(48).toString("base64url")],
    ["HERO_IDENTITY_OWNER_USER_ID", current.get("HERO_IDENTITY_OWNER_USER_ID") || "hero-owner"],
    ["HERO_OWNER_EMAIL", ownerEmail],
    ["HERO_OWNER_DISPLAY_NAME", current.get("HERO_OWNER_DISPLAY_NAME") || "Hero Test Owner"],
    ["HERO_OWNER_PASSWORD", ownerPassword],
    ["HERO_OWNER_MFA_SECRET", `base32:${mfaBase32}`],
    ["HERO_OWNER_MFA_SECRET_REF", current.get("HERO_OWNER_MFA_SECRET_REF") || "env:HERO_OWNER_MFA_SECRET"]
  ]);
}

function ensurePrivateDirectory(root) {
  assertDirectory(root, "Repository root");
  const variableDirectory = path.join(root, "var");
  assertDirectory(variableDirectory, "Repository var directory");
  const privateDirectory = path.join(variableDirectory, "private");
  assertDirectory(privateDirectory, "Private access directory", { create: true });
  fs.chmodSync(privateDirectory, 0o700);
  return privateDirectory;
}

function createAccessBundle({ privateDirectory, basicUser, basicPassword, ownerEmail, ownerPassword, mfaBase32 }) {
  const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const file = path.join(privateDirectory, `hero-test-owner-access-${timestamp}.txt`);
  const accountLabel = encodeURIComponent(`Hero Test:${ownerEmail}`);
  const issuer = encodeURIComponent("Hero Test");
  const account = encodeURIComponent(ownerEmail);
  const setupUri = `otpauth://totp/${accountLabel}?secret=${mfaBase32}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
  const bundle = [
    "HERO TEST — OWNER ACCESS (CONFIDENTIAL)",
    "=======================================",
    "Environment: Test only",
    "URL: https://test.hero.beeproject.ir/api/portal?surface=identity",
    "Created: " + new Date().toISOString(),
    "",
    "Legacy Network Basic Auth (do not use for the Portal login)",
    `Username: ${basicUser}`,
    `Password: ${basicPassword}`,
    "The canonical URL above uses Human Identity directly. If a browser Basic prompt appears, cancel it and reopen that exact Portal URL.",
    "",
    "Human Identity — enter these in the Portal form",
    `Email: ${ownerEmail}`,
    `Password: ${ownerPassword}`,
    "",
    "MFA — add manually to an Authenticator app",
    `Secret: ${mfaBase32}`,
    `Setup URI: ${setupUri}`,
    "",
    "This file is mode 0600, ignored by Git, and belongs only to Hero Test.",
    "Store it in your approved password manager, then remove this local access bundle."
  ].join("\n");
  writeAtomically(file, `${bundle}\n`, "Test owner access bundle");
  return file;
}

export function provisionTestOwnerIdentity({ root = ROOT, authorizationFile = path.join(root, "config/authorizations/backoffice-20260911-020.json") } = {}) {
  const resolvedRoot = path.resolve(root);
  assertDirectory(resolvedRoot, "Repository root");
  const environmentFile = path.join(resolvedRoot, ".env");
  if (!assertRegularFile(environmentFile, "Hero Test .env")) fail("The Hero Test .env file does not exist.");
  validateAuthorization(authorizationFile);

  const source = fs.readFileSync(environmentFile, "utf8");
  const current = parseEnvironment(source);
  const basicUser = current.get("HERO_BACKOFFICE_USER") ?? "";
  const basicPassword = current.get("HERO_BACKOFFICE_PASSWORD") ?? "";
  if (basicUser.length < 1 || basicPassword.length < 16) fail("Existing Test Basic Auth is missing or too short; it was not changed.");

  // Prove the target is Test before creating any credential material. Identity
  // fields are filled with safe placeholders only for this validation pass.
  const targetCheck = new Map(current);
  for (const [key, value] of [
    ["HERO_IDENTITY_SESSION_SECRET", current.get("HERO_IDENTITY_SESSION_SECRET") || "x".repeat(32)],
    ["HERO_OWNER_EMAIL", current.get("HERO_OWNER_EMAIL") || OWNER_EMAIL_FALLBACK],
    ["HERO_OWNER_PASSWORD", current.get("HERO_OWNER_PASSWORD") || "x".repeat(12)],
    ["HERO_OWNER_MFA_SECRET", current.get("HERO_OWNER_MFA_SECRET") || "base32:ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"],
    ["HERO_IDENTITY_OWNER_USER_ID", current.get("HERO_IDENTITY_OWNER_USER_ID") || "hero-owner"]
  ]) targetCheck.set(key, value);
  validateProspectiveEnvironment(targetCheck);

  const updates = buildUpdates(current);
  const next = updateEnvironment(source, updates);
  const nextValues = parseEnvironment(next);
  validateProspectiveEnvironment(nextValues);

  const privateDirectory = ensurePrivateDirectory(resolvedRoot);
  const accessBundle = createAccessBundle({
    privateDirectory,
    basicUser,
    basicPassword,
    ownerEmail: updates.get("HERO_OWNER_EMAIL"),
    ownerPassword: updates.get("HERO_OWNER_PASSWORD"),
    mfaBase32: updates.get("HERO_OWNER_MFA_SECRET").slice("base32:".length)
  });
  if (next !== source) writeAtomically(environmentFile, next, "Hero Test .env");

  const manifest = JSON.stringify({
    schema: "hero.test-owner-identity-provision/v1",
    authorizationId: "BATCH-BACKOFFICE-20260911-020",
    environment: "test",
    provisionedAt: new Date().toISOString(),
    identityFields: [...updates.keys()],
    accessBundle: path.basename(accessBundle),
    secretsIncluded: false
  }, null, 2) + "\n";
  const manifestFile = path.join(privateDirectory, `hero-test-owner-identity-provision-${Date.now()}.json`);
  writeAtomically(manifestFile, manifest, "Test identity provision manifest");

  return Object.freeze({ accessBundle: path.relative(resolvedRoot, accessBundle), manifest: path.relative(resolvedRoot, manifestFile) });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const result = provisionTestOwnerIdentity();
    console.log("Hero Test owner identity provisioned without rotating the existing Basic Auth credential.");
    console.log(`Private access bundle written to ${result.accessBundle} (mode 0600; Git-ignored).`);
    console.log(`Secret-free provision manifest written to ${result.manifest}.`);
  } catch (error) {
    console.error(`Hero Test owner identity provisioning: BLOCKED — ${error.message}`);
    process.exitCode = 1;
  }
}
