/**
 * Delivery truth: one honest view of "what actually works", computed from the two machine
 * registries (delivery audit and requirement trace) instead of being re-typed into prose.
 * Pure function: no file system, no network. The caller passes the parsed registries.
 */

const STEP_STATUSES = ["verified", "partial", "gated", "owner_pending", "deferred"];
const REQUIREMENT_STATUSES = ["implemented", "partial", "missing"];
const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

export function toPersianDigits(value) {
  return String(value).replace(/\d/g, digit => FA_DIGITS[Number(digit)]);
}

function stepNumber(id) {
  const match = /^BO-(\d{3})$/.exec(id ?? "");
  return match ? Number(match[1]) : null;
}

function zeroCounts(keys) {
  return Object.fromEntries(keys.map(key => [key, 0]));
}

function rate(part, whole) {
  return whole === 0 ? 0 : Number((part / whole).toFixed(4));
}

export function computeDeliveryTruth({ audit, trace, signals = [], now = () => new Date().toISOString() } = {}) {
  const issues = [];
  if (!audit || !Array.isArray(audit.ranges)) throw new TypeError("A delivery audit with ranges is required.");
  if (!trace || !Array.isArray(trace.requirements)) throw new TypeError("A requirement trace with requirements is required.");

  const steps = { total: 0, byStatus: zeroCounts(STEP_STATUSES) };
  const workPackages = new Map();
  const openGates = [];
  const covered = new Set();
  for (const range of audit.ranges) {
    const from = stepNumber(range.from);
    const to = stepNumber(range.to);
    if (from === null || to === null || to < from) { issues.push(`range ${range.from}..${range.to} is malformed`); continue; }
    const count = to - from + 1;
    if (count !== range.count) issues.push(`range ${range.from}..${range.to} declares count ${range.count} but spans ${count}`);
    for (let number = from; number <= to; number += 1) {
      if (covered.has(number)) issues.push(`BO-${String(number).padStart(3, "0")} appears in more than one range`);
      covered.add(number);
    }
    if (!STEP_STATUSES.includes(range.status)) { issues.push(`range ${range.from}..${range.to} has unknown status ${range.status}`); continue; }
    steps.total += count;
    steps.byStatus[range.status] += count;
    const wp = workPackages.get(range.work_package) ?? { workPackage: range.work_package, total: 0, byStatus: zeroCounts(STEP_STATUSES) };
    wp.total += count;
    wp.byStatus[range.status] += count;
    workPackages.set(range.work_package, wp);
    if (range.status !== "verified") openGates.push({ from: range.from, to: range.to, count, status: range.status, workPackage: range.work_package, openGate: range.open_gate ?? "unspecified" });
  }
  for (let number = 1; number <= 170; number += 1) if (!covered.has(number)) { issues.push(`BO-${String(number).padStart(3, "0")} is not covered by any range`); break; }

  const declared = audit.summary ?? {};
  for (const status of STEP_STATUSES) {
    if (declared[status] !== undefined && declared[status] !== steps.byStatus[status]) issues.push(`audit summary says ${status}=${declared[status]} but the ranges add up to ${steps.byStatus[status]}`);
  }
  if (declared.total !== undefined && declared.total !== steps.total) issues.push(`audit summary says total=${declared.total} but the ranges add up to ${steps.total}`);

  const requirements = { total: trace.requirements.length, byStatus: zeroCounts(REQUIREMENT_STATUSES) };
  const requirementWorkPackages = new Map();
  const gaps = [];
  for (const requirement of trace.requirements) {
    if (!REQUIREMENT_STATUSES.includes(requirement.status)) { issues.push(`requirement ${requirement.id} has unknown status ${requirement.status}`); continue; }
    requirements.byStatus[requirement.status] += 1;
    const wp = requirementWorkPackages.get(requirement.work_package) ?? { workPackage: requirement.work_package, total: 0, implemented: 0, open: 0 };
    wp.total += 1;
    if (requirement.status === "implemented") wp.implemented += 1; else wp.open += 1;
    requirementWorkPackages.set(requirement.work_package, wp);
    if (requirement.status !== "implemented") gaps.push({ id: requirement.id, status: requirement.status, workPackage: requirement.work_package, gap: requirement.gap ?? "" });
  }
  const currentClaim = audit.requirement_current ?? {};
  for (const status of REQUIREMENT_STATUSES) {
    if (currentClaim[status] !== undefined && currentClaim[status] !== requirements.byStatus[status]) issues.push(`audit says ${status} requirements=${currentClaim[status]} but the trace has ${requirements.byStatus[status]}`);
  }

  const stepsVerifiedRate = rate(steps.byStatus.verified, steps.total);
  const requirementsImplementedRate = rate(requirements.byStatus.implemented, requirements.total);
  const headlineFa = `${toPersianDigits(steps.byStatus.verified)} از ${toPersianDigits(steps.total)} گام تأیید شده است، اما فقط ${toPersianDigits(requirements.byStatus.implemented)} از ${toPersianDigits(requirements.total)} نیازمندی محصول کاملاً پیاده‌سازی شده است. تأیید یک گام به معنی تکمیل قابلیت برای کاربر نیست.`;

  const nextActions = [];
  if (steps.byStatus.gated > 0) nextActions.push({ kind: "authorization", textFa: `${toPersianDigits(steps.byStatus.gated)} گام فقط با مجوز عملیاتی جداگانه (اتصال زنده، Secret یا Production) قابل تأیید است.` });
  if (steps.byStatus.owner_pending > 0) nextActions.push({ kind: "owner-decision", textFa: `${toPersianDigits(steps.byStatus.owner_pending)} گام منتظر ثبت پذیرش مالک است و عامل نمی‌تواند آن را جایگزین کند.` });
  if (requirements.byStatus.partial + requirements.byStatus.missing > 0) nextActions.push({ kind: "engineering", textFa: `${toPersianDigits(requirements.byStatus.partial + requirements.byStatus.missing)} نیازمندی هنوز برش کامل UI، ماندگاری و شواهد اجرا ندارد.` });

  return Object.freeze({
    schema: "hero.delivery-truth/v1",
    generatedAt: now(),
    source: Object.freeze({ auditId: audit.audit_id ?? null, auditedAt: audit.audited_at ?? null, releaseCandidate: audit.source?.release_candidate ?? null, productionChange: audit.source?.production_change ?? "unknown", requirementAssessedAt: trace.assessed_at ?? null }),
    steps: Object.freeze({ ...steps, remainingToVerified: steps.total - steps.byStatus.verified, verifiedRate: stepsVerifiedRate }),
    requirements: Object.freeze({ ...requirements, implementedRate: requirementsImplementedRate }),
    honestyGap: Number((stepsVerifiedRate - requirementsImplementedRate).toFixed(4)),
    headlineFa,
    workPackages: Object.freeze([...workPackages.values()].sort((a, b) => a.workPackage.localeCompare(b.workPackage))),
    requirementWorkPackages: Object.freeze([...requirementWorkPackages.values()].sort((a, b) => a.workPackage.localeCompare(b.workPackage))),
    openGates: Object.freeze(openGates),
    requirementGaps: Object.freeze(gaps),
    signals: Object.freeze(signals.map(signal => Object.freeze({ id: String(signal.id), label: String(signal.label), status: String(signal.status), detail: signal.detail === undefined ? undefined : String(signal.detail) }))),
    nextActions: Object.freeze(nextActions),
    integrity: Object.freeze({ consistent: issues.length === 0, issues: Object.freeze(issues) })
  });
}
