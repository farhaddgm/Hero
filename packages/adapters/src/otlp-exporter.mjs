import { createHash } from "node:crypto";

import { SPAN_ID_PATTERN, TRACE_ID_PATTERN, projectOperationalEvent } from "../../contracts/src/observability.mjs";

/**
 * OTLP/HTTP JSON log exporter for Hero operational events.
 *
 * Off by default. It never opens a connection itself: the caller injects `transport`. Events go
 * through the same allow-list projection as the Back Office timeline, so prompts, outputs and
 * credentials cannot reach a collector. A failing collector never throws into the caller.
 */

const MAX_BATCH_BYTES = 1_000_000;
const HEADER_ALLOWLIST = new Set(["authorization", "x-api-key"]);

export class OtlpExporterError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "OtlpExporterError";
    this.code = code;
  }
}

function hex(input, length) {
  return createHash("sha256").update(String(input)).digest("hex").slice(0, length);
}

/** A correlation id that is already a W3C trace id is kept; anything else maps to a stable one. */
export function traceIdFor(correlationId, fallback) {
  if (typeof correlationId === "string" && TRACE_ID_PATTERN.test(correlationId)) return correlationId;
  return hex(correlationId ?? fallback ?? "no-correlation", 32);
}

export function spanIdFor(eventId, sequence) {
  if (typeof eventId === "string" && SPAN_ID_PATTERN.test(eventId)) return eventId;
  return hex(eventId ?? `sequence-${sequence}`, 16);
}

function attribute(key, value) {
  if (typeof value === "boolean") return { key, value: { boolValue: value } };
  if (typeof value === "number") return Number.isInteger(value) ? { key, value: { intValue: String(value) } } : { key, value: { doubleValue: value } };
  return { key, value: { stringValue: String(value).slice(0, 256) } };
}

function severityFor(event) {
  const text = `${event.type ?? ""} ${event.data?.status ?? ""} ${event.data?.outcome ?? ""}`;
  if (/blocked|failed|rejected|denied|stop/i.test(text)) return { severityNumber: 13, severityText: "WARN" };
  return { severityNumber: 9, severityText: "INFO" };
}

export function toOtlpLogs(events, { serviceName = "hero-control-plane", serviceVersion = "unknown", environment = "unknown" } = {}) {
  const records = events.map(raw => {
    const event = projectOperationalEvent(raw);
    const millis = Date.parse(event.occurredAt ?? "");
    const nanos = Number.isFinite(millis) ? `${BigInt(millis) * 1_000_000n}` : "0";
    const attributes = [
      attribute("hero.event.kind", event.kind ?? "unknown"),
      attribute("hero.event.type", event.type ?? "unknown"),
      attribute("hero.aggregate.type", event.aggregateType ?? "unknown"),
      attribute("hero.aggregate.id", event.aggregateId ?? "unknown"),
      attribute("hero.actor.kind", event.actorKind ?? "unknown"),
      ...Object.entries(event.data).map(([key, value]) => attribute(`hero.data.${key}`, value))
    ];
    if (event.sequence !== null) attributes.push(attribute("hero.event.sequence", event.sequence));
    return {
      timeUnixNano: nanos,
      observedTimeUnixNano: nanos,
      ...severityFor(event),
      body: { stringValue: event.type ?? "event" },
      attributes,
      traceId: traceIdFor(event.correlationId, event.aggregateId),
      spanId: spanIdFor(event.eventId, event.sequence)
    };
  });
  return {
    resourceLogs: [{
      resource: { attributes: [attribute("service.name", serviceName), attribute("service.version", serviceVersion), attribute("deployment.environment", environment)] },
      scopeLogs: [{ scope: { name: "hero.operational-events", version: "1.0" }, logRecords: records }]
    }]
  };
}

function validateEndpoint(endpoint, allowedHosts, allowPrivateEndpoint) {
  let url;
  try { url = new URL(endpoint); } catch { throw new OtlpExporterError("INVALID_ENDPOINT", "The OTLP endpoint is not a valid URL."); }
  if (url.username || url.password || url.search || url.hash) throw new OtlpExporterError("INVALID_ENDPOINT", "The OTLP endpoint must not carry credentials, a query or a fragment.");
  if (url.protocol !== "https:" && !(allowPrivateEndpoint && url.protocol === "http:")) throw new OtlpExporterError("INVALID_ENDPOINT", "The OTLP endpoint must use https.");
  if (!Array.isArray(allowedHosts) || !allowedHosts.includes(url.hostname)) throw new OtlpExporterError("HOST_NOT_ALLOWED", "The OTLP host is not on the explicit allowlist.");
  if (!allowPrivateEndpoint && (url.hostname === "localhost" || /^(?:10|127|169\.254|192\.168)\./.test(url.hostname) || /^172\.(?:1[6-9]|2\d|3[01])\./.test(url.hostname) || !url.hostname.includes("."))) {
    throw new OtlpExporterError("PRIVATE_ENDPOINT", "A private or internal endpoint needs allowPrivateEndpoint to be set explicitly.");
  }
  return url;
}

export function createOtlpExporter(options = {}) {
  const enabled = options.enabled === true;
  if (!enabled) {
    return Object.freeze({ enabled: false, async export() { return Object.freeze({ status: "disabled", exported: 0, failed: 0, batches: 0 }); } });
  }
  const url = validateEndpoint(options.endpoint, options.allowedHosts, options.allowPrivateEndpoint === true);
  if (typeof options.transport !== "function") throw new OtlpExporterError("TRANSPORT_REQUIRED", "An injected transport is required; the exporter never opens connections itself.");
  const headers = { "content-type": "application/json" };
  for (const [name, value] of Object.entries(options.headers ?? {})) {
    if (!HEADER_ALLOWLIST.has(name.toLowerCase())) throw new OtlpExporterError("HEADER_NOT_ALLOWED", `Header ${name} is not allowed.`);
    if (typeof value !== "string" || value.length === 0 || /[\r\n]/.test(value)) throw new OtlpExporterError("HEADER_NOT_ALLOWED", `Header ${name} has an invalid value.`);
    headers[name.toLowerCase()] = value;
  }
  const target = `${url.origin}${url.pathname.replace(/\/$/, "")}/v1/logs`;
  const maxBatch = Number.isInteger(options.maxBatch) && options.maxBatch > 0 ? Math.min(options.maxBatch, 500) : 100;
  const timeoutMs = options.timeoutMs ?? 5_000;
  const resource = { serviceName: options.serviceName, serviceVersion: options.serviceVersion, environment: options.environment };

  return Object.freeze({
    enabled: true,
    target,
    async export(events) {
      if (!Array.isArray(events)) throw new OtlpExporterError("INVALID_EVENTS", "events must be an array.");
      let exported = 0; let failed = 0; let batches = 0;
      for (let index = 0; index < events.length; index += maxBatch) {
        const slice = events.slice(index, index + maxBatch);
        const body = JSON.stringify(toOtlpLogs(slice, resource));
        if (Buffer.byteLength(body) > MAX_BATCH_BYTES) { failed += slice.length; batches += 1; continue; }
        batches += 1;
        let timer;
        try {
          const result = await Promise.race([
            Promise.resolve(options.transport({ url: target, headers: { ...headers }, body })),
            new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), timeoutMs); })
          ]);
          if (result && Number.isInteger(result.status) && result.status >= 200 && result.status < 300) exported += slice.length; else failed += slice.length;
        } catch {
          failed += slice.length;
        } finally {
          clearTimeout(timer);
        }
      }
      return Object.freeze({ status: failed === 0 ? "exported" : exported === 0 ? "failed" : "partial", exported, failed, batches });
    }
  });
}

/** Reads the HERO_OTEL_* variables from a supplied environment object. Disabled unless explicitly enabled. */
export function createOtlpExporterFromEnv(env = {}, { transport, serviceVersion, environment } = {}) {
  if (env.HERO_OTEL_EXPORT_ENABLED !== "true") return createOtlpExporter({ enabled: false });
  return createOtlpExporter({
    enabled: true,
    endpoint: env.HERO_OTEL_ENDPOINT,
    allowedHosts: String(env.HERO_OTEL_ALLOWED_HOSTS ?? "").split(",").map(item => item.trim()).filter(Boolean),
    allowPrivateEndpoint: env.HERO_OTEL_ALLOW_PRIVATE_ENDPOINT === "true",
    transport, serviceVersion, environment
  });
}
