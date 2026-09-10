import test from "node:test";
import assert from "node:assert/strict";
import { validateEnvironmentParity } from "../tools/check-environment-parity.mjs";

const baseEnv = `
HERO_HTTP_HOST=0.0.0.0
HERO_HTTP_PORT=3100
HERO_BIND_ADDRESS=127.0.0.1
HERO_EXPOSE_PORT=PORT
HERO_IMAGE=
HERO_DATA_DIR=/var/lib/hero
HERO_LOG_LEVEL=info
HERO_OWNER_AUTH_SECRET=
HERO_ADMIN_AUTH_SECRET=
HERO_BACKOFFICE_USER=
HERO_BACKOFFICE_PASSWORD=
HERO_POSTGRES_URL=
HERO_POSTGRES_PASSWORD=
HERO_REQUIRE_POSTGRES=true
HERO_ENABLE_REAL_PROVIDERS=false
HERO_OPENAI_API_KEY=
HERO_ANTHROPIC_API_KEY=
HERO_GOOGLE_API_KEY=
HERO_OPENAI_COMPATIBLE_API_KEY=
HERO_EXTERNAL_SPEND_AUTHORIZATION_ACTIVE=false
HERO_EXTERNAL_SPEND_AUTHORIZATION_ID=
HERO_EXTERNAL_SPEND_PROJECT_ID=
HERO_EXTERNAL_SPEND_STEP_ID=
HERO_EXTERNAL_SPEND_DOCUMENT_VERSION=
HERO_EXTERNAL_SPEND_PROVIDER_ID=
HERO_EXTERNAL_SPEND_MODEL_IDS=
HERO_EXTERNAL_SPEND_ROLE_IDS=
HERO_EXTERNAL_SPEND_MAX_COST_UNITS=
HERO_EXTERNAL_SPEND_EXPIRES_AT=
HERO_EXTERNAL_SPEND_GLOBAL_STOP=false
`;

const compose = [
  "control-plane:",
  "    image: ${HERO_IMAGE:-hero-control-plane:local}",
  "    dockerfile: Dockerfile",
  "  hero-postgres:",
  "  hero-data:",
  "  hero-postgres-data:",
  "  hero-private:",
  "      HERO_ENABLE_REAL_PROVIDERS: ${HERO_ENABLE_REAL_PROVIDERS:-false}",
  "      HERO_EXTERNAL_SPEND_GLOBAL_STOP: ${HERO_EXTERNAL_SPEND_GLOBAL_STOP:-false}"
].join("\n");

test("environment parity accepts the shared contract and the two test ports", () => {
  const errors = validateEnvironmentParity({
    testEnv: baseEnv.replace("HERO_EXPOSE_PORT=PORT", "HERO_EXPOSE_PORT=43101"),
    productionEnv: baseEnv.replace("HERO_EXPOSE_PORT=PORT", "HERO_EXPOSE_PORT=43100"),
    compose
  });
  assert.deepEqual(errors, []);
});

test("environment parity rejects drift in a required key", () => {
  const errors = validateEnvironmentParity({
    testEnv: baseEnv.replace("HERO_EXPOSE_PORT=PORT", "HERO_EXPOSE_PORT=43101").replace("HERO_ENABLE_REAL_PROVIDERS=false\n", ""),
    productionEnv: baseEnv.replace("HERO_EXPOSE_PORT=PORT", "HERO_EXPOSE_PORT=43100"),
    compose
  });
  assert.ok(errors.some((error) => error.includes("HERO_ENABLE_REAL_PROVIDERS")));
});
