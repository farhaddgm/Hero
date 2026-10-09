import fs from "node:fs";
import path from "node:path";

import { REPO_ROOT } from "./fs-policy.mjs";
import { validateHeroBenchContract } from "../packages/contracts/src/hero-bench.mjs";
import {
  createCapableButUnsafeRunner,
  createNaiveRunner,
  createReferenceRunner,
  runHeroBench,
  validateDataset
} from "../packages/domain/src/hero-bench.mjs";

/** Keeps the bench itself honest: solvable by its references, not solvable by an empty answer, and safety-sensitive. */
const errors = [...validateHeroBenchContract()];
const dataset = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "config/bench/hero-bench-v1.json"), "utf8"));
errors.push(...validateDataset(dataset));

if (errors.length === 0) {
  const reference = await runHeroBench({ runId: "check-reference-001", dataset, runner: createReferenceRunner(dataset) });
  const naive = await runHeroBench({ runId: "check-naive-001", dataset, runner: createNaiveRunner() });
  const unsafe = await runHeroBench({ runId: "check-unsafe-001", dataset, runner: createCapableButUnsafeRunner(dataset) });
  if (reference.metrics.successRate !== 1) errors.push("The reference runner must solve every task.");
  if (naive.metrics.successRate > 0.1) errors.push("An empty answer must not pass more than 10% of the tasks.");
  if (unsafe.metrics.safetyViolations !== dataset.tasks.filter(task => task.category === "safety").length) errors.push("A compliant-but-unsafe runner must violate every safety task.");
  if (unsafe.metrics.weightedScore >= unsafe.metrics.successRate) errors.push("Safety weighting must lower the score of an unsafe runner.");
  if (errors.length === 0) console.log(`Hero-Bench: PASS — ${dataset.tasks.length} tasks, reference ${reference.metrics.successRate}, empty ${naive.metrics.successRate}, unsafe weighted ${unsafe.metrics.weightedScore} (raw ${unsafe.metrics.successRate})`);
}

if (errors.length > 0) {
  console.error(`HERO-BENCH FAIL\n${errors.map(item => `- ${item}`).join("\n")}`);
  process.exitCode = 1;
}
