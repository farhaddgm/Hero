import fs from "node:fs";
import path from "node:path";

import { REPO_ROOT } from "./fs-policy.mjs";
import { validateProductTemplatesContract } from "../packages/contracts/src/product-templates.mjs";
import { validateTemplateRegistry } from "../packages/domain/src/product-templates.mjs";
import { validateAcceptanceCriteriaContract } from "../packages/contracts/src/acceptance-criteria.mjs";
import { compileCriteria, validateStructuredRegistry } from "../packages/domain/src/acceptance-compiler.mjs";

const registry = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "config/product-templates/templates-v1.json"), "utf8"));
const acceptance = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "config/product-templates/acceptance-v1.json"), "utf8"));
const errors = [...validateProductTemplatesContract(), ...validateTemplateRegistry(registry), ...validateAcceptanceCriteriaContract(), ...validateStructuredRegistry(acceptance, registry)];
// NX-011: report how many structured criteria are machine-checkable, without rounding it up.
const coverage = acceptance.templates.map(entry => compileCriteria({ templateId: entry.templateId, items: entry.items }).coverage);
const totals = coverage.reduce((sum, item) => ({ total: sum.total + item.total, automatable: sum.automatable + item.automatable, manual: sum.manual + item.manual, needsClarification: sum.needsClarification + item.needsClarification }), { total: 0, automatable: 0, manual: 0, needsClarification: 0 });
if (errors.length > 0) {
  console.error(`PRODUCT TEMPLATES FAIL\n${errors.map(item => `- ${item}`).join("\n")}`);
  process.exitCode = 1;
} else {
  console.log(`Product templates: PASS — ${registry.templates.length} templates, independent review, closed egress and unknown-is-not-no enforced; ${totals.total} structured acceptance criteria: ${totals.automatable} automatable, ${totals.manual} manual, ${totals.needsClarification} need clarification`);
}
