import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = Object.freeze({
  compose: path.join(root, "compose.yaml"),
  testEnv: path.join(root, "deploy", "test", "hero-test.env.example"),
  caddyTest: path.join(root, "deploy", "backoffice", "Caddyfile.test.example")
});

function read(name, file) {
  if (!fs.existsSync(file)) throw new Error(`${name} is missing: ${path.relative(root, file)}`);
  return fs.readFileSync(file, "utf8");
}

const compose = read("Compose contract", files.compose);
const testEnv = read("Test environment example", files.testEnv);
const caddyTest = read("Test Caddy contract", files.caddyTest);
const errors = [];
const warnings = [];

function requireMatch(source, pattern, message) {
  if (!pattern.test(source)) errors.push(message);
}

function rejectMatch(source, pattern, message) {
  if (pattern.test(source)) errors.push(message);
}

requireMatch(compose, /control-plane:/, "Compose must define the control-plane service.");
requireMatch(compose, /hero-postgres:\s*\n\s*profiles:\s*\[\"postgres\"\]/, "PostgreSQL must remain behind the postgres profile.");
requireMatch(compose, /- \"\$\{HERO_BIND_ADDRESS:-127\.0\.0\.1\}:\$\{HERO_EXPOSE_PORT:-43100\}:3100\"/, "The application port must default to loopback and remain configurable for Test.");
requireMatch(compose, /hero-data:/, "The application must use the project-scoped hero-data volume.");
requireMatch(compose, /hero-postgres-data:/, "PostgreSQL must use its own project-scoped volume.");
requireMatch(compose, /hero-private:\s*\n\s*driver:\s*bridge/, "Services must use the private hero-private network.");
requireMatch(compose, /HERO_ENABLE_REAL_PROVIDERS:\s*\$\{HERO_ENABLE_REAL_PROVIDERS:-false\}/, "Live Providers must default to disabled.");
rejectMatch(compose, /hero-postgres:[\s\S]{0,700}?\n\s+ports:/, "PostgreSQL must not publish a host port.");
rejectMatch(compose, /0\.0\.0\.0:\$\{HERO_EXPOSE_PORT/, "The application must not publish the host port on every interface.");

requireMatch(testEnv, /^HERO_EXPOSE_PORT=43101$/m, "The Test example must use host port 43101.");
requireMatch(testEnv, /^HERO_ENABLE_REAL_PROVIDERS=false$/m, "The Test example must keep live Providers disabled.");
requireMatch(testEnv, /^HERO_BIND_ADDRESS=127\.0\.0\.1$/m, "The Test example must bind only to localhost.");

requireMatch(caddyTest, /^test\.hero\.beeproject\.ir \{$/m, "The canonical Test hostname must be test.hero.beeproject.ir.");
requireMatch(caddyTest, /reverse_proxy 127\.0\.0\.1:43101/, "Caddy Test must proxy to 127.0.0.1:43101.");
requireMatch(caddyTest, /basic_auth\s*\{/, "Caddy Test Back Office must retain Basic Auth.");
rejectMatch(caddyTest, /hero-test\.beeproject\.ir/, "The legacy/conflicting hero-test.beeproject.ir hostname must not be mixed into the Test contract.");
rejectMatch(caddyTest, /:5432\b/, "Caddy must not expose PostgreSQL.");

const opaqueOverride = path.join(root, "compose.test.yaml");
if (fs.existsSync(opaqueOverride)) {
  warnings.push("compose.test.yaml exists outside the tracked deployment contract; review it before any privileged execution and do not use it implicitly.");
}

if (errors.length > 0) {
  console.error("Deployment contract: FAILED");
  errors.forEach(error => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log("Deployment contract: PASS");
}
warnings.forEach(warning => console.warn(`WARNING: ${warning}`));
