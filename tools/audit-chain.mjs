import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { auditIntegritySignal, verifyAuditChainDetailed } from "../packages/domain/src/audit-chain-verifier.mjs";

/**
 * NX-002 — read-only audit chain verification.
 *
 *   node tools/audit-chain.mjs --file <audit.json> [--head-seq <n> --head-hash <sha256>]
 *
 * The file holds an array of gateway audit entries, or { "entries": [...], "head": { "seq": n, "hash": "..." } }.
 * It never writes, repairs or rewrites a chain. Exit codes: 0 intact or consistent, 1 broken, 2 unknown.
 */
export function runAuditChainCommand(argv, { cwd = process.cwd(), stdout = process.stdout, stderr = process.stderr } = {}) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 2) args.set(argv[index], argv[index + 1]);
  const file = args.get("--file");
  if (!file) {
    stderr.write("usage: audit-chain --file <audit.json> [--head-seq <n> --head-hash <sha256>]\n");
    stdout.write(`${JSON.stringify(auditIntegritySignal(verifyAuditChainDetailed(null)))}\n`);
    return 2;
  }
  let parsed;
  try {
    const absolute = path.resolve(cwd, file);
    parsed = JSON.parse(fs.readFileSync(absolute, "utf8"));
  } catch (error) {
    stderr.write(`cannot read the audit file: ${error.code ?? error.name}\n`);
    stdout.write(`${JSON.stringify(auditIntegritySignal(verifyAuditChainDetailed(null)))}\n`);
    return 2;
  }
  const entries = Array.isArray(parsed) ? parsed : parsed?.entries;
  let expectedHead = Array.isArray(parsed) ? null : parsed?.head ?? null;
  if (args.has("--head-seq")) expectedHead = { seq: Number(args.get("--head-seq")), hash: args.get("--head-hash") ?? "" };
  const verification = verifyAuditChainDetailed(entries, { expectedHead });
  stdout.write(`${JSON.stringify({ verification, signal: auditIntegritySignal(verification) }, null, 2)}\n`);
  return verification.status === "broken" ? 1 : verification.status === "unknown" ? 2 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = runAuditChainCommand(process.argv.slice(2));
}
