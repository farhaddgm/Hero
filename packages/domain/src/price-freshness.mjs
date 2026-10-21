import { createHash } from "node:crypto";

import { normalizePricingCatalog } from "../../contracts/src/pricing-catalog.mjs";
import { toPersianDigits } from "./delivery-truth.mjs";

/**
 * NX-021 — price freshness gate.
 *
 * A cost cap compared with an estimate built on an expired price can call an insufficient cap
 * "sufficient". This module makes that comparison fail closed: a price whose validity has ended,
 * or that carries no readable validity, is `stale` and the comparison reports `PRICE_STALE`.
 * It also reports a deterministic diff between two catalog versions and an "N days left" notice.
 *
 * Boundary: it never fetches or invents a price. Updating prices from an external source is a
 * separate gated step; a price this module cannot read is "stale", never "fresh".
 */

export const PRICE_STALE = "PRICE_STALE";
export const PRICE_FRESHNESS_UNKNOWN = "PRICE_FRESHNESS_UNKNOWN";
export const DEFAULT_EXPIRY_WARNING_DAYS = 7;

const DAY_MS = 86_400_000;
const PRICE_FIELDS = Object.freeze(["inputPricePer1mTokens", "outputPricePer1mTokens", "cachedInputPricePer1mTokens", "unitPrice"]);

function toMillis(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return Number.isFinite(value) ? value : Number.NaN;
  if (typeof value === "string" && value.trim() !== "") return Date.parse(value);
  return Number.NaN;
}

function label(providerId, modelId) {
  return `${providerId}/${modelId}`;
}

/**
 * Classifies one price validity. Anything unreadable (missing, malformed, or an unreadable clock)
 * is `stale`, never `fresh`: the unknown must not read as healthy.
 */
export function assessPriceFreshness({ providerId = "unknown", modelId = "unknown", validUntil, now, warnDays = DEFAULT_EXPIRY_WARNING_DAYS } = {}) {
  const nowMs = toMillis(typeof now === "function" ? now() : now);
  const untilMs = toMillis(validUntil);
  const base = { providerId, modelId, validUntil: typeof validUntil === "string" ? validUntil : null };
  if (!Number.isInteger(warnDays) || warnDays < 0 || warnDays > 365) throw new RangeError("warnDays must be an integer between 0 and 365.");
  if (Number.isNaN(nowMs)) {
    return Object.freeze({ ...base, status: "stale", reliable: false, code: PRICE_FRESHNESS_UNKNOWN, daysRemaining: null, messageFa: `زمان فعلی خوانده نشد؛ قیمت ${label(providerId, modelId)} غیرقابل‌اتکا فرض شد.` });
  }
  if (Number.isNaN(untilMs)) {
    return Object.freeze({ ...base, status: "stale", reliable: false, code: PRICE_STALE, daysRemaining: null, messageFa: `قیمت ${label(providerId, modelId)} تاریخ اعتبار قابل‌خواندن ندارد و غیرقابل‌اتکا است.` });
  }
  if (untilMs <= nowMs) {
    const daysAgo = Math.max(0, Math.floor((nowMs - untilMs) / DAY_MS));
    return Object.freeze({ ...base, status: "stale", reliable: false, code: PRICE_STALE, daysRemaining: -daysAgo, messageFa: `قیمت ${label(providerId, modelId)} منقضی شده است و برای مقایسهٔ سقف هزینه قابل‌اتکا نیست.` });
  }
  const daysRemaining = Math.ceil((untilMs - nowMs) / DAY_MS);
  if (daysRemaining <= warnDays) {
    return Object.freeze({ ...base, status: "expiring", reliable: true, code: null, daysRemaining, messageFa: `${toPersianDigits(daysRemaining)} روز تا انقضای قیمت ${label(providerId, modelId)} مانده است.` });
  }
  return Object.freeze({ ...base, status: "fresh", reliable: true, code: null, daysRemaining, messageFa: `قیمت ${label(providerId, modelId)} معتبر است.` });
}

/** Assesses every distinct priced model in a list and states whether an estimate may rely on them. */
export function assessPriceReliance({ entries = [], now, warnDays = DEFAULT_EXPIRY_WARNING_DAYS } = {}) {
  const seen = new Set();
  const assessments = [];
  for (const entry of entries) {
    const key = label(entry?.providerId, entry?.modelId);
    if (seen.has(key)) continue;
    seen.add(key);
    assessments.push(assessPriceFreshness({ providerId: entry?.providerId, modelId: entry?.modelId, validUntil: entry?.validUntil, now, warnDays }));
  }
  assessments.sort((a, b) => label(a.providerId, a.modelId).localeCompare(label(b.providerId, b.modelId)));
  const stalePrices = assessments.filter(item => item.status === "stale");
  const expiringSoon = assessments.filter(item => item.status === "expiring");
  const unknownClock = stalePrices.some(item => item.code === PRICE_FRESHNESS_UNKNOWN);
  return Object.freeze({
    reliable: stalePrices.length === 0,
    code: stalePrices.length === 0 ? null : unknownClock ? PRICE_FRESHNESS_UNKNOWN : PRICE_STALE,
    stalePrices: Object.freeze(stalePrices.map(item => Object.freeze({ providerId: item.providerId, modelId: item.modelId, validUntil: item.validUntil }))),
    expiringSoon: Object.freeze(expiringSoon.map(item => Object.freeze({ providerId: item.providerId, modelId: item.modelId, validUntil: item.validUntil, daysRemaining: item.daysRemaining }))),
    notices: Object.freeze(assessments.filter(item => item.status !== "fresh").map(item => item.messageFa))
  });
}

function comparablePrice(entry) {
  return Object.fromEntries(PRICE_FIELDS.map(field => [field, entry[field] ?? null]));
}

function percent(from, to) {
  if (from === null || to === null) return null;
  if (from === 0) return to === 0 ? 0 : null;
  return Number((((to - from) / from) * 100).toFixed(2));
}

/**
 * Deterministic diff between two pricing catalogs: added, removed, increased, decreased, mixed and
 * unchanged models. A currency or pricing-mode change is `incomparable`, not a number. Same inputs
 * always give the same report and digest.
 */
export function diffPricingCatalogs(previousCatalog, nextCatalog) {
  const previous = normalizePricingCatalog(previousCatalog);
  const next = normalizePricingCatalog(nextCatalog);
  const previousByKey = new Map(previous.entries.map(entry => [label(entry.providerId, entry.modelId), entry]));
  const nextByKey = new Map(next.entries.map(entry => [label(entry.providerId, entry.modelId), entry]));
  const keys = [...new Set([...previousByKey.keys(), ...nextByKey.keys()])].sort();

  const changes = [];
  const counts = { added: 0, removed: 0, increased: 0, decreased: 0, mixed: 0, incomparable: 0, unchanged: 0 };
  for (const key of keys) {
    const before = previousByKey.get(key);
    const after = nextByKey.get(key);
    const ref = after ?? before;
    const identity = { providerId: ref.providerId, modelId: ref.modelId };
    if (!before) { counts.added += 1; changes.push({ ...identity, change: "added" }); continue; }
    if (!after) { counts.removed += 1; changes.push({ ...identity, change: "removed" }); continue; }
    if (before.currency !== after.currency || before.pricingMode !== after.pricingMode) {
      counts.incomparable += 1;
      changes.push({ ...identity, change: "incomparable", from: { currency: before.currency, pricingMode: before.pricingMode }, to: { currency: after.currency, pricingMode: after.pricingMode } });
      continue;
    }
    const fields = {};
    let up = 0;
    let down = 0;
    for (const field of PRICE_FIELDS) {
      const from = before[field] ?? null;
      const to = after[field] ?? null;
      if (from === to) continue;
      fields[field] = { from, to, percent: percent(from, to) };
      if (from === null || (to !== null && to > from)) up += 1;
      else down += 1;
    }
    if (up === 0 && down === 0) { counts.unchanged += 1; continue; }
    const change = up > 0 && down > 0 ? "mixed" : up > 0 ? "increased" : "decreased";
    counts[change] += 1;
    changes.push({ ...identity, change, fields });
  }

  const report = {
    schema: "hero.pricing-catalog-diff/v1",
    from: { catalogVersion: previous.catalogVersion, validUntil: previous.validUntil },
    to: { catalogVersion: next.catalogVersion, validUntil: next.validUntil },
    counts,
    changes
  };
  const digest = createHash("sha256").update(JSON.stringify(report)).digest("hex");
  return Object.freeze({
    ...report,
    changes: Object.freeze(changes.map(item => Object.freeze(item))),
    counts: Object.freeze(counts),
    digest,
    boundary: "diff-only: never fetches, edits or activates a price"
  });
}
