import { randomBytes } from "node:crypto";

import { SPAN_ID_PATTERN, TRACE_ID_PATTERN } from "../../contracts/src/observability.mjs";

function copy(value) {
  return Object.freeze(structuredClone(value));
}

function hex(bytes) {
  return randomBytes(bytes).toString("hex");
}

function valid(label, value, pattern) {
  if (typeof value !== "string" || !pattern.test(value)) throw new ObservabilityError("INVALID_TRACE_CONTEXT", `${label} is invalid.`);
  return value;
}

export class ObservabilityError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ObservabilityError";
    this.code = code;
  }
}

export function createCorrelationContext(input = {}) {
  const traceId = input.traceId === undefined ? hex(16) : valid("traceId", input.traceId, TRACE_ID_PATTERN);
  const spanId = input.spanId === undefined ? hex(8) : valid("spanId", input.spanId, SPAN_ID_PATTERN);
  const parentSpanId = input.parentSpanId === undefined || input.parentSpanId === null
    ? null
    : valid("parentSpanId", input.parentSpanId, SPAN_ID_PATTERN);
  const traceFlags = input.traceFlags === undefined ? "01" : input.traceFlags;
  if (!/^[0-9a-f]{2}$/.test(traceFlags)) throw new ObservabilityError("INVALID_TRACE_CONTEXT", "traceFlags is invalid.");
  return copy({ traceId, spanId, parentSpanId, traceFlags, traceparent: `00-${traceId}-${spanId}-${traceFlags}` });
}

export function childCorrelationContext(parent = {}) {
  const context = createCorrelationContext(parent);
  return createCorrelationContext({ traceId: context.traceId, parentSpanId: context.spanId, traceFlags: context.traceFlags });
}
