import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const testEnvPath = path.join(repoRoot, "deploy", "test", "hero-test.env.example");
const productionEnvPath = path.join(repoRoot, "deploy", "production", "hero-production.env.example");
const composePath = path.join(repoRoot, "compose.yaml");

const REQUIRED_KEYS = [
  "HERO_HTTP_HOST",
  "HERO_HTTP_PORT",
  "HERO_UI_ENVIRONMENT",
  "HERO_BIND_ADDRESS",
  "HERO_EXPOSE_PORT",
  "HERO_IMAGE",
  "HERO_RELEASE_VERSION",
  "HERO_SOURCE_COMMIT",
  "HERO_IMAGE_DIGEST",
  "HERO_DATA_DIR",
  "HERO_LOG_LEVEL",
  "HERO_SECRET_STORE_ENABLED",
  "HERO_SECRET_STORE_DIR",
  "HERO_SECRET_STORE_MASTER_KEY",
  "HERO_OWNER_AUTH_SECRET",
  "HERO_ADMIN_AUTH_SECRET",
  "HERO_IDENTITY_SESSION_SECRET",
  "HERO_MFA_ENCRYPTION_KEY",
  "HERO_MFA_ENCRYPTION_KEY_PREVIOUS",
  "HERO_IDENTITY_OWNER_USER_ID",
  "HERO_OWNER_EMAIL",
  "HERO_OWNER_DISPLAY_NAME",
  "HERO_OWNER_PASSWORD",
  "HERO_OWNER_MFA_SECRET",
  "HERO_OWNER_MFA_SECRET_REF",
  "HERO_BACKOFFICE_USER",
  "HERO_BACKOFFICE_PASSWORD",
  "HERO_POSTGRES_URL",
  "HERO_POSTGRES_PASSWORD",
  "HERO_REQUIRE_POSTGRES",
  "HERO_ENABLE_REAL_PROVIDERS",
  "HERO_OPENAI_API_KEY",
  "HERO_ANTHROPIC_API_KEY",
  "HERO_GOOGLE_API_KEY",
  "HERO_CURSOR_API_KEY",
  "HERO_OPENAI_COMPATIBLE_API_KEY",
  "HERO_EXTERNAL_SPEND_AUTHORIZATION_ACTIVE",
  "HERO_EXTERNAL_SPEND_AUTHORIZATION_ID",
  "HERO_EXTERNAL_SPEND_PROJECT_ID",
  "HERO_EXTERNAL_SPEND_PROJECT_SCOPE",
  "HERO_EXTERNAL_SPEND_ENVIRONMENT",
  "HERO_EXTERNAL_SPEND_STEP_ID",
  "HERO_EXTERNAL_SPEND_DOCUMENT_VERSION",
  "HERO_EXTERNAL_SPEND_PROVIDER_ID",
  "HERO_EXTERNAL_SPEND_MODEL_IDS",
  "HERO_EXTERNAL_SPEND_ROLE_IDS",
  "HERO_EXTERNAL_SPEND_CAPABILITIES",
  "HERO_EXTERNAL_SPEND_MAX_COST_UNITS",
  "HERO_EXTERNAL_SPEND_EXPIRES_AT",
  "HERO_EXTERNAL_SPEND_GLOBAL_STOP"
];

const EXACT_SHARED_DEFAULTS = {
  HERO_HTTP_HOST: "0.0.0.0",
  HERO_HTTP_PORT: "3100",
  HERO_BIND_ADDRESS: "127.0.0.1",
  HERO_DATA_DIR: "/var/lib/hero",
  HERO_LOG_LEVEL: "info",
  HERO_SECRET_STORE_DIR: "/var/lib/hero/secret-store",
  HERO_IDENTITY_OWNER_USER_ID: "hero-owner",
  HERO_OWNER_DISPLAY_NAME: "Hero Owner",
  HERO_REQUIRE_POSTGRES: "true",
  HERO_ENABLE_REAL_PROVIDERS: "false",
  HERO_EXTERNAL_SPEND_AUTHORIZATION_ACTIVE: "false",
  HERO_EXTERNAL_SPEND_PROJECT_SCOPE: "single-project",
  HERO_EXTERNAL_SPEND_GLOBAL_STOP: "false"
};

const EMPTY_IN_EXAMPLES = new Set([
  "HERO_OWNER_AUTH_SECRET",
  "HERO_ADMIN_AUTH_SECRET",
  "HERO_IDENTITY_SESSION_SECRET",
  "HERO_MFA_ENCRYPTION_KEY",
  "HERO_MFA_ENCRYPTION_KEY_PREVIOUS",
  "HERO_OWNER_EMAIL",
  "HERO_OWNER_PASSWORD",
  "HERO_OWNER_MFA_SECRET",
  "HERO_OWNER_MFA_SECRET_REF",
  "HERO_BACKOFFICE_USER",
  "HERO_BACKOFFICE_PASSWORD",
  "HERO_POSTGRES_URL",
  "HERO_POSTGRES_PASSWORD",
  "HERO_SECRET_STORE_MASTER_KEY",
  "HERO_IMAGE",
  "HERO_RELEASE_VERSION",
  "HERO_SOURCE_COMMIT",
  "HERO_IMAGE_DIGEST",
  "HERO_OPENAI_API_KEY",
  "HERO_ANTHROPIC_API_KEY",
  "HERO_GOOGLE_API_KEY",
  "HERO_OPENAI_COMPATIBLE_API_KEY",
  "HERO_EXTERNAL_SPEND_AUTHORIZATION_ID",
  "HERO_EXTERNAL_SPEND_PROJECT_ID",
  "HERO_EXTERNAL_SPEND_ENVIRONMENT",
  "HERO_EXTERNAL_SPEND_STEP_ID",
  "HERO_EXTERNAL_SPEND_DOCUMENT_VERSION",
  "HERO_EXTERNAL_SPEND_PROVIDER_ID",
  "HERO_EXTERNAL_SPEND_MODEL_IDS",
  "HERO_EXTERNAL_SPEND_ROLE_IDS",
  "HERO_EXTERNAL_SPEND_CAPABILITIES",
  "HERO_EXTERNAL_SPEND_MAX_COST_UNITS",
  "HERO_EXTERNAL_SPEND_EXPIRES_AT"
]);

export function parseEnvExample(source, fileName = "environment file") {
  const values = {};
  const errors = [];

  source.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const match = trimmed.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!match) {
      errors.push(`${fileName}:${index + 1}: expected KEY=VALUE`);
      return;
    }
    const [, key, value] = match;
    if (Object.hasOwn(values, key)) errors.push(`${fileName}:${index + 1}: duplicate key ${key}`);
    values[key] = value;
  });

  return { values, errors };
}

function sortedDifference(left, right) {
  return [...left].filter((key) => !right.has(key)).sort();
}

export function validateEnvironmentParity({ testEnv, productionEnv, compose }) {
  const errors = [];
  const test = parseEnvExample(testEnv, "deploy/test/hero-test.env.example");
  const production = parseEnvExample(productionEnv, "deploy/production/hero-production.env.example");
  errors.push(...test.errors, ...production.errors);

  const testKeys = new Set(Object.keys(test.values));
  const productionKeys = new Set(Object.keys(production.values));
  const missingInTest = sortedDifference(productionKeys, testKeys);
  const missingInProduction = sortedDifference(testKeys, productionKeys);
  if (missingInTest.length) errors.push(`keys missing in Test example: ${missingInTest.join(", ")}`);
  if (missingInProduction.length) errors.push(`keys missing in Production example: ${missingInProduction.join(", ")}`);

  for (const key of REQUIRED_KEYS) {
    if (!testKeys.has(key)) errors.push(`Test example is missing required key ${key}`);
    if (!productionKeys.has(key)) errors.push(`Production example is missing required key ${key}`);
  }

  for (const [key, expected] of Object.entries(EXACT_SHARED_DEFAULTS)) {
    if (test.values[key] !== expected) errors.push(`Test ${key} must be ${expected}`);
    if (production.values[key] !== expected) errors.push(`Production ${key} must be ${expected}`);
  }

  if (test.values.HERO_EXPOSE_PORT !== "43101") errors.push("Test HERO_EXPOSE_PORT must be 43101");
  if (production.values.HERO_EXPOSE_PORT !== "43100") errors.push("Production HERO_EXPOSE_PORT must be 43100");
  if (test.values.HERO_UI_ENVIRONMENT !== "test") errors.push("Test UI environment must be test");
  if (production.values.HERO_UI_ENVIRONMENT !== "production") errors.push("Production UI environment must be production");

  for (const key of EMPTY_IN_EXAMPLES) {
    if (test.values[key] !== "") errors.push(`Test ${key} must stay empty in the committed example`);
    if (production.values[key] !== "") errors.push(`Production ${key} must stay empty in the committed example`);
  }

  const requiredComposeFragments = [
    "control-plane:",
    "hero-postgres:",
    "hero-data:",
    "hero-postgres-data:",
    "hero-private:",
    'dockerfile: Dockerfile',
    'HERO_RELEASE_VERSION: ${HERO_RELEASE_VERSION:-}',
    'HERO_SOURCE_COMMIT: ${HERO_SOURCE_COMMIT:-}',
    'HERO_IMAGE_DIGEST: ${HERO_IMAGE_DIGEST:-}',
    'HERO_UI_ENVIRONMENT: ${HERO_UI_ENVIRONMENT:-}',
    'HERO_IDENTITY_SESSION_SECRET: ${HERO_IDENTITY_SESSION_SECRET:-}',
    'HERO_MFA_ENCRYPTION_KEY: ${HERO_MFA_ENCRYPTION_KEY:-}',
    'HERO_MFA_ENCRYPTION_KEY_PREVIOUS: ${HERO_MFA_ENCRYPTION_KEY_PREVIOUS:-}',
    'HERO_SECRET_STORE_ENABLED: ${HERO_SECRET_STORE_ENABLED:-false}',
    'HERO_SECRET_STORE_DIR: ${HERO_SECRET_STORE_DIR:-/var/lib/hero/secret-store}',
    'HERO_SECRET_STORE_MASTER_KEY: ${HERO_SECRET_STORE_MASTER_KEY:-}',
    'HERO_OWNER_EMAIL: ${HERO_OWNER_EMAIL:-}',
    'HERO_OWNER_PASSWORD: ${HERO_OWNER_PASSWORD:-}',
    'HERO_OWNER_MFA_SECRET: ${HERO_OWNER_MFA_SECRET:-}',
    'HERO_ENABLE_REAL_PROVIDERS: ${HERO_ENABLE_REAL_PROVIDERS:-false}',
    'HERO_EXTERNAL_SPEND_CAPABILITIES: ${HERO_EXTERNAL_SPEND_CAPABILITIES:-}',
    'HERO_EXTERNAL_SPEND_PROJECT_SCOPE: ${HERO_EXTERNAL_SPEND_PROJECT_SCOPE:-single-project}',
    'HERO_EXTERNAL_SPEND_ENVIRONMENT: ${HERO_EXTERNAL_SPEND_ENVIRONMENT:-}',
    'HERO_EXTERNAL_SPEND_GLOBAL_STOP: ${HERO_EXTERNAL_SPEND_GLOBAL_STOP:-false}'
  ];
  for (const fragment of requiredComposeFragments) {
    if (!compose.includes(fragment)) errors.push(`compose.yaml is missing the shared contract fragment: ${fragment}`);
  }

  return errors;
}

export function runEnvironmentParityCheck() {
  const errors = validateEnvironmentParity({
    testEnv: fs.readFileSync(testEnvPath, "utf8"),
    productionEnv: fs.readFileSync(productionEnvPath, "utf8"),
    compose: fs.readFileSync(composePath, "utf8")
  });

  if (errors.length) {
    console.error("Environment parity: FAIL");
    for (const error of errors) console.error(`- ${error}`);
    return 1;
  }

  console.log("Environment parity: PASS");
  console.log("- Test and Production use the same Compose/application contract.");
  console.log("- Shared defaults, provider safety gates, and authorization stop controls match.");
  console.log("- Allowed runtime differences: project name, UI environment label, secrets, and exposed port (43101 Test / 43100 Production).");
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(runEnvironmentParityCheck());
