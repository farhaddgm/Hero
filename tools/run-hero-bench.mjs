import fs from "node:fs";
import path from "node:path";

import { REPO_ROOT } from "./fs-policy.mjs";
import {
  HeroBenchError,
  compareRuns,
  createCapableButUnsafeRunner,
  createLiveRunnerPlaceholder,
  createNaiveRunner,
  createOverconfidentRunner,
  createReferenceRunner,
  runHeroBench,
  validateDataset
} from "../packages/domain/src/hero-bench.mjs";

/**
 * Offline Hero-Bench CLI.
 *   node tools/run-hero-bench.mjs --runner reference|naive|overconfident|capable-unsafe [--compare other] [--out file.json]
 * `--runner live` is refused: a live run needs an external-spend authorization and a bound adapter.
 */
const DATASET_PATH = "config/bench/hero-bench-v1.json";
const args = process.argv.slice(2);
const option = name => { const index = args.indexOf(`--${name}`); return index === -1 ? null : args[index + 1] ?? null; };

const dataset = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, DATASET_PATH), "utf8"));
const problems = validateDataset(dataset);
if (problems.length > 0) { console.error(`HERO-BENCH DATASET INVALID\n${problems.map(item => `- ${item}`).join("\n")}`); process.exit(1); }

function runnerFor(name) {
  switch (name) {
    case "reference": return createReferenceRunner(dataset);
    case "naive": return createNaiveRunner();
    case "overconfident": return createOverconfidentRunner();
    case "capable-unsafe": return createCapableButUnsafeRunner(dataset);
    case "live": return createLiveRunnerPlaceholder();
    default: return null;
  }
}

const name = option("runner") ?? "reference";
const runner = runnerFor(name);
if (!runner) { console.error(`Unknown runner "${name}".`); process.exit(2); }

try {
  const run = await runHeroBench({ runId: `bench-${name}-cli`, dataset, runner });
  const output = { run };
  const other = option("compare");
  if (other) {
    const second = runnerFor(other);
    if (!second) { console.error(`Unknown runner "${other}".`); process.exit(2); }
    output.comparison = compareRuns(run, await runHeroBench({ runId: `bench-${other}-cli`, dataset, runner: second }));
  }
  const text = JSON.stringify(output, null, 2);
  const out = option("out");
  if (out) {
    const target = path.resolve(REPO_ROOT, out);
    if (!target.startsWith(REPO_ROOT + path.sep)) { console.error("--out must stay inside the repository."); process.exit(2); }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${text}\n`);
  } else {
    console.log(text);
  }
} catch (error) {
  if (error instanceof HeroBenchError) { console.error(`HERO-BENCH REFUSED [${error.code}] ${error.message}`); process.exit(3); }
  throw error;
}
