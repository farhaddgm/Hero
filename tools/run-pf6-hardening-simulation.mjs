import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { runPf6HardeningSimulation } from "../packages/domain/src/pf6-hardening-harness.mjs";

const runId = process.env.HERO_PF6_RUN_ID ?? `pf6-simulation-${Date.now()}`;
const sourceCommit = process.env.HERO_SOURCE_COMMIT ?? "workspace-uncommitted";
const evidenceDir = path.resolve(process.env.HERO_PF6_EVIDENCE_DIR ?? `/tmp/hero-pf6-hardening-evidence-${runId}`);
const evidence = { schema: "hero.product-factory-pf6-simulation/v1", runId, sourceCommit, simulation: runPf6HardeningSimulation(), boundary: { networkCalls: 0, browserRuntime: false, production: false, pilot: false, secretValues: false, externalSpend: false } };
mkdirSync(evidenceDir, { recursive: true, mode: 0o700 });
const body = `${JSON.stringify(evidence, null, 2)}\n`;
const file = path.join(evidenceDir, "pf6-hardening-simulation.json");
writeFileSync(file, body, { mode: 0o444 });
chmodSync(file, 0o444);
const digest = `sha256:${createHash("sha256").update(body).digest("hex")}`;
console.log(JSON.stringify({ runId, evidenceDir, evidenceDigest: digest, status: evidence.simulation.status, projects: evidence.simulation.projects.length, traces: evidence.simulation.loadSoak.tracesWritten, networkCalls: 0 }));
