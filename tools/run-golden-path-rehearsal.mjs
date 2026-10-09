import fs from "node:fs";
import path from "node:path";

import { REPO_ROOT } from "./fs-policy.mjs";
import { createGoldenPath } from "../packages/domain/src/golden-path.mjs";
import { createProductTemplateRegistry } from "../packages/domain/src/product-templates.mjs";

/** Offline Golden Path rehearsal. It never calls a provider and never starts a live run. */
const read = relative => JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relative), "utf8"));
const impl = { providerId: "rehearsal-provider", modelId: "rehearsal-implementer" };
const reviewer = { providerId: "rehearsal-provider", modelId: "rehearsal-reviewer" };
const golden = createGoldenPath({
  templates: createProductTemplateRegistry(read("config/product-templates/templates-v1.json")),
  catalog: read("config/golden-path/rehearsal-catalog.json"),
  assignments: { analyst: impl, designer: impl, writer: impl, implementer: impl, tester: impl, reviewer },
  benchDataset: read("config/bench/hero-bench-v1.json")
});

const args = process.argv.slice(2);
const option = name => { const index = args.indexOf(`--${name}`); return index === -1 ? null : args[index + 1] ?? null; };
const check = args.includes("--check");
const templates = check ? ["static-site", "contact-form-site", "crud-admin-panel", "rest-api", "mobile-reminder-app"] : [option("template") ?? "static-site"];

const failures = [];
const reports = [];
for (const templateId of templates) {
  const report = await golden.rehearse({ templateId, projectId: "rehearsal-project", name: "تمرین مسیر طلایی", budgetCostUnits: option("budget") ? Number(option("budget")) : null });
  reports.push(report);
  if (!report.rehearsalPassed) failures.push(`${templateId}: ${report.stages.filter(item => item.status === "blocked").map(item => item.id).join(", ")}`);
}

if (check) {
  if (failures.length > 0) { console.error(`GOLDEN PATH REHEARSAL FAIL\n${failures.map(item => `- ${item}`).join("\n")}`); process.exit(1); }
  console.log(`Golden path rehearsal: PASS — ${reports.length} templates, offline stages passed, live stages not run (${reports[0].stages.filter(item => item.status === "requires-live").length} require live authorization)`);
} else {
  console.log(JSON.stringify(reports[0], null, 2));
  if (failures.length > 0) process.exit(1);
}
