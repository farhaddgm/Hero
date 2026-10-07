// BO-159: deterministic digests of Hero's read models, taken from the live HTTP
// views. After a rebuild (restart, restore, transfer) every digest must match.
import { sha256 } from "../acceptance/audit-lib.mjs";

export const READ_MODEL_VIEWS = Object.freeze([
  ["notifications", "/notifications?view=all"], ["incidents", "/incidents"], ["audit-activity", "/audit-log?limit=200&stream=activity"], ["audit-security", "/audit-log?limit=200&stream=security"], ["timeline", "/timeline?limit=200"],
  ["slo", "/slo"], ["hardening", "/hardening"], ["retention-policy", "/retention-policy"], ["retention-plan", "/retention"], ["final-readiness", "/final-readiness"],
  ["ledger-team", "/ledger?groupBy=team"], ["ledger-model", "/ledger?groupBy=model"], ["budget", "/budget"], ["health", "/health"], ["catalog", "/catalog"], ["operations", "/operations"], ["observability", "/observability"]
]);

export async function readModelDigests(call, projectId, { as = "owner" } = {}) {
  const digests = {};
  for (const [name, path] of READ_MODEL_VIEWS) { const response = await call(as, "GET", `/api/projects/${projectId}${path}`); digests[name] = { status: response.status, digest: sha256(response.body) }; }
  return digests;
}
export function diffDigests(before, after) { return Object.keys(before).filter(name => before[name].status !== after[name]?.status || before[name].digest !== after[name]?.digest); }
