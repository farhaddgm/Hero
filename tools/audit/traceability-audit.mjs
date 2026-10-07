// BO-164: audits every requirement id and every delivery-audit range against the
// repository. An evidence path must exist; a claim of "implemented" or "verified"
// needs a real test among its evidence and a recorded run; a partial requirement
// must state its gap. The result is counted, not asserted.
import fs from "node:fs";
import path from "node:path";
import { createRecorder } from "../acceptance/audit-lib.mjs";

export function auditTraceability({ root, recorder = createRecorder("tools/audit/traceability-audit") }) {
  const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
  const exists = relative => fs.existsSync(path.join(root, relative));
  const trace = read("config/backoffice/requirement-trace-v1.0.json"); const audit = read("config/backoffice/delivery-audit-v1.0.json");
  const idPattern = /^BO-[A-Z]{2,5}-\d{3}$/; const states = new Set(trace.status_values ?? ["implemented", "partial", "missing"]);
  const ids = trace.requirements.map(item => item.id);
  recorder.check(`traceability: ${ids.length} requirement ids are unique and well formed`, new Set(ids).size === ids.length && ids.every(id => idPattern.test(id)), ids.filter(id => !idPattern.test(id)).join(","));
  recorder.check("traceability: every requirement has a known status and a work package", trace.requirements.every(item => states.has(item.status) && /^WP-\d{2}$/.test(item.work_package)));
  const missingFiles = trace.requirements.flatMap(item => (item.evidence ?? []).filter(file => !exists(file)).map(file => `${item.id}: ${file}`));
  recorder.check("traceability: every requirement's evidence path exists in the repository", missingFiles.length === 0, missingFiles.slice(0, 6).join("; "));
  const noEvidence = trace.requirements.filter(item => item.status !== "missing" && !(item.evidence ?? []).length).map(item => item.id);
  recorder.check("traceability: no implemented or partial requirement lacks evidence", noEvidence.length === 0, noEvidence.join(","));
  const isTest = file => /^tests\//.test(file) && /\.(test|browser)\.mjs$/.test(file) || /^tools\/(acceptance|audit)\//.test(file);
  const implementedWithoutTest = trace.requirements.filter(item => item.status === "implemented" && !(item.evidence ?? []).some(isTest)).map(item => item.id);
  recorder.check("traceability: every implemented requirement is backed by a test or an executable audit", implementedWithoutTest.length === 0, implementedWithoutTest.join(","));
  const sourceOf = item => (item.evidence ?? []).filter(file => /^(?:packages|apps)\/.+\.mjs$/.test(file)); const testsOf = item => (item.evidence ?? []).filter(file => /^tests\//.test(file));
  const unlinked = trace.requirements.filter(item => item.status === "implemented" && sourceOf(item).length && testsOf(item).length && !testsOf(item).some(file => sourceOf(item).some(source => fs.readFileSync(path.join(root, file), "utf8").includes(path.basename(source, ".mjs"))))).map(item => item.id);
  recorder.check("traceability: a test listed for an implemented requirement actually names one of its source modules", unlinked.length === 0, unlinked.join(","));
  const partialWithoutGap = trace.requirements.filter(item => item.status === "partial" && String(item.gap ?? "").trim().length < 20).map(item => item.id);
  recorder.check("traceability: every partial requirement states its gap", partialWithoutGap.length === 0, partialWithoutGap.join(","));
  // delivery-audit ranges
  const rangeMissing = audit.ranges.flatMap(range => (range.evidence ?? []).filter(file => !exists(file)).map(file => `${range.from}..${range.to}: ${file}`));
  recorder.check(`traceability: every evidence path of the ${audit.ranges.length} delivery-audit ranges exists`, rangeMissing.length === 0, rangeMissing.slice(0, 6).join("; "));
  const verified = audit.ranges.filter(range => range.status === "verified");
  const verifiedWithoutProof = verified.filter(range => range.open_gate !== "none" && !/(?:run \d{8}T\d{6}Z-[a-f0-9]{6}|Verified \d{4}-\d{2}-\d{2})/.test(range.open_gate ?? "")).map(range => `${range.from}..${range.to}`);
  recorder.check(`traceability: each of the ${verified.length} verified ranges names its acceptance run or verification date`, verifiedWithoutProof.length === 0, verifiedWithoutProof.join(","));
  const verifiedNoTest = verified.filter(range => range.work_package !== "WP-00" && !(range.evidence ?? []).some(isTest)).map(range => `${range.from}..${range.to}`);
  recorder.check("traceability: every verified range lists a test or an executable audit", verifiedNoTest.length === 0, verifiedNoTest.join(","));
  const sum = audit.summary; const counted = audit.ranges.reduce((acc, range) => { acc[range.status] = (acc[range.status] ?? 0) + range.count; return acc; }, {});
  recorder.check("traceability: the audit summary equals the sum of its ranges", ["verified", "partial", "gated", "owner_pending", "deferred"].every(status => (counted[status] ?? 0) === sum[status]), JSON.stringify(counted));
  recorder.check("traceability: the audit covers exactly 170 steps", audit.ranges.reduce((total, range) => total + range.count, 0) === 170);
  // authorization records
  const authorizations = fs.readdirSync(path.join(root, "config/authorizations")).filter(file => file.endsWith(".json"));
  // The verbatim owner statement became part of every batch record on 2026-10-06. Earlier records are history and are never rewritten (rule 13); they are counted, not hidden.
  const records = authorizations.map(file => ({ file, record: read(`config/authorizations/${file}`) })); const modern = records.filter(({ record }) => /^BATCH-BACKOFFICE-|^TEST-RELEASE-/.test(record.authorizationId ?? "") && String(record.grantedAt ?? "") >= "2026-10-06");
  const unsigned = modern.filter(({ record }) => !String(record.ownerStatement ?? "").trim() || !record.grantedBy).map(({ file }) => file);
  recorder.check(`traceability: all ${modern.length} authorization records since 2026-10-06 carry the verbatim owner statement (${records.length - modern.length} earlier records are history)`, modern.length > 0 && unsigned.length === 0, unsigned.join(","));
  // every step in a batch authorization resolves to a delivery-audit range
  const stepIds = new Set(); for (const range of audit.ranges) { const [a, b] = [range.from, range.to].map(id => Number(id.slice(3))); for (let n = a; n <= b; n += 1) stepIds.add(`BO-${String(n).padStart(3, "0")}`); }
  const orphaned = authorizations.flatMap(file => (read(`config/authorizations/${file}`).steps ?? []).filter(step => /^BO-\d{3}$/.test(step.stepId) && !stepIds.has(step.stepId)).map(step => `${file}:${step.stepId}`));
  recorder.check("traceability: every step in every authorization exists in the delivery audit", orphaned.length === 0, orphaned.slice(0, 5).join(","));
  return recorder;
}
