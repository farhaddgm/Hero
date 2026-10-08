/**
 * BO-138: Production payload never enters AI context, Memory or Evaluation.
 * One small guard, used at each of those doors, so the rule is checked in one place.
 */
export class ProductionDataError extends Error { constructor(message) { super(message); this.name = "ProductionDataError"; this.code = "PRODUCTION_PAYLOAD_FORBIDDEN"; this.statusCode = 403; } }

const REFERENCE = /^hero:\/\/(?:production|prod)(?:[/:?#]|$)/i;
const KINDS = /^(?:production[-_ ]?(?:data|payload|dump|log)|prod[-_ ]?(?:data|payload)|customer[-_ ]?data)$/i;
const KEYS = /^(?:productionPayload|production_payload|prodPayload|rawPayload|customerData)$/;

/** True when a source reference or kind points at Production data. */
export function isProductionPayloadSource({ reference, kind } = {}) {
  return (typeof reference === "string" && REFERENCE.test(reference)) || (typeof kind === "string" && KINDS.test(kind));
}

/** Throws when a value (or anything nested in it) is, or points at, Production payload. */
export function assertNoProductionPayload(value, label = "input", depth = 0) {
  if (depth > 8 || value === null || typeof value !== "object") return;
  if (Array.isArray(value)) { for (const item of value.slice(0, 200)) assertNoProductionPayload(item, label, depth + 1); return; }
  if (isProductionPayloadSource(value)) throw new ProductionDataError(`${label} refers to Production data, which may not enter AI, Memory or Evaluation.`);
  for (const [key, child] of Object.entries(value)) {
    if (KEYS.test(key)) throw new ProductionDataError(`${label}.${key} carries Production payload, which may not enter AI, Memory or Evaluation.`);
    assertNoProductionPayload(child, `${label}.${key}`, depth + 1);
  }
}
