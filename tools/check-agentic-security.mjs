import fs from "node:fs";
import path from "node:path";

import { REPO_ROOT } from "./fs-policy.mjs";
import {
  OWASP_AGENTIC_CONTROLS,
  validateAgentToolGatewayContract
} from "../packages/contracts/src/agent-tool-gateway.mjs";

/**
 * Fails when an OWASP agentic category loses its control, implementation file, test file or
 * its adversarial test in the red-team suite. It does not run the tests (`node --test` does);
 * it keeps the mapping honest so a category cannot be dropped silently.
 */
const errors = [...validateAgentToolGatewayContract()];

function readRepoFile(relative) {
  const absolute = path.join(REPO_ROOT, relative);
  if (!fs.existsSync(absolute)) { errors.push(`Missing file: ${relative}`); return ""; }
  return fs.readFileSync(absolute, "utf8");
}

const redteam = readRepoFile("tests/agent-redteam.test.mjs");
for (const category of OWASP_AGENTIC_CONTROLS) {
  if (!new RegExp(`test\\("${category.id}\\b`).test(redteam)) errors.push(`${category.id} has no red-team test named after it.`);
  for (const control of category.controls) {
    readRepoFile(control.implementation);
    const testSource = readRepoFile(control.test);
    if (testSource && !/\btest\(/.test(testSource)) errors.push(`${control.test} contains no tests.`);
  }
}

if (errors.length > 0) {
  console.error(`AGENTIC SECURITY FAIL\n${errors.map(error => `- ${error}`).join("\n")}`);
  process.exitCode = 1;
} else {
  const controls = OWASP_AGENTIC_CONTROLS.reduce((sum, category) => sum + category.controls.length, 0);
  console.log(`Agentic security: PASS — ${OWASP_AGENTIC_CONTROLS.length} OWASP categories, ${controls} mapped controls, red-team test per category`);
}
