import fs from "node:fs";
import path from "node:path";

import { REPO_ROOT } from "./fs-policy.mjs";
import { validateProductTemplatesContract } from "../packages/contracts/src/product-templates.mjs";
import { validateTemplateRegistry } from "../packages/domain/src/product-templates.mjs";

const registry = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "config/product-templates/templates-v1.json"), "utf8"));
const errors = [...validateProductTemplatesContract(), ...validateTemplateRegistry(registry)];
if (errors.length > 0) {
  console.error(`PRODUCT TEMPLATES FAIL\n${errors.map(item => `- ${item}`).join("\n")}`);
  process.exitCode = 1;
} else {
  console.log(`Product templates: PASS — ${registry.templates.length} templates, independent review, closed egress and unknown-is-not-no enforced`);
}
