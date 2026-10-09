import assert from "node:assert/strict";
import test from "node:test";

import { OtlpExporterError, createOtlpExporter, createOtlpExporterFromEnv, spanIdFor, toOtlpLogs, traceIdFor } from "../packages/adapters/src/otlp-exporter.mjs";

const event = (overrides = {}) => ({
  sequence: 7, eventId: "evt_000007", type: "ai.invocation-completed", aggregateType: "invocation", aggregateId: "INV-0001",
  occurredAt: "2026-10-09T10:00:00.000Z", actor: { kind: "orchestrator", id: "hero-control-plane" }, correlationId: "corr-1",
  data: { runId: "RUN-1", costUnits: 42, status: "completed", prompt: "SECRET PROMPT TEXT", apiKey: "sk-should-never-leave", output: "raw model output" },
  ...overrides
});

test("disabled is the default: nothing is validated, sent or required", async () => {
  const exporter = createOtlpExporter({});
  assert.equal(exporter.enabled, false);
  assert.deepEqual(await exporter.export([event()]), { status: "disabled", exported: 0, failed: 0, batches: 0 });
  assert.equal(createOtlpExporterFromEnv({}).enabled, false);
  assert.equal(createOtlpExporterFromEnv({ HERO_OTEL_EXPORT_ENABLED: "false", HERO_OTEL_ENDPOINT: "https://otel.example.com" }).enabled, false);
});

test("events are projected through the allow-list: prompts, outputs and keys never reach the payload", () => {
  const payload = JSON.stringify(toOtlpLogs([event()], { serviceVersion: "1.2.3", environment: "test" }));
  for (const forbidden of ["SECRET PROMPT TEXT", "sk-should-never-leave", "raw model output", "apiKey", "prompt"]) assert.equal(payload.includes(forbidden), false, forbidden);
  const record = toOtlpLogs([event()]).resourceLogs[0].scopeLogs[0].logRecords[0];
  assert.equal(record.timeUnixNano, "1791540000000000000");
  assert.equal(record.severityText, "INFO");
  assert.equal(record.body.stringValue, "ai.invocation-completed");
  const attrs = Object.fromEntries(record.attributes.map(item => [item.key, item.value]));
  assert.deepEqual(attrs["hero.data.costUnits"], { intValue: "42" });
  assert.deepEqual(attrs["hero.data.runId"], { stringValue: "RUN-1" });
  assert.match(record.traceId, /^[0-9a-f]{32}$/);
  assert.match(record.spanId, /^[0-9a-f]{16}$/);
});

test("trace and span ids are deterministic, and real W3C ids are kept", () => {
  assert.equal(traceIdFor("corr-1"), traceIdFor("corr-1"));
  assert.notEqual(traceIdFor("corr-1"), traceIdFor("corr-2"));
  assert.equal(traceIdFor("0af7651916cd43dd8448eb211c80319c"), "0af7651916cd43dd8448eb211c80319c");
  assert.equal(spanIdFor("b7ad6b7169203331"), "b7ad6b7169203331");
  assert.match(spanIdFor(undefined, 3), /^[0-9a-f]{16}$/);
  const blocked = toOtlpLogs([event({ type: "authorization.dispatch-blocked", data: { status: "blocked" } })]).resourceLogs[0].scopeLogs[0].logRecords[0];
  assert.equal(blocked.severityText, "WARN");
});

test("enabling requires https, an allowlisted host, no credentials and an injected transport", () => {
  const ok = { enabled: true, endpoint: "https://otel.example.com/collector", allowedHosts: ["otel.example.com"], transport: async () => ({ status: 200 }) };
  assert.equal(createOtlpExporter(ok).target, "https://otel.example.com/collector/v1/logs");
  const bad = (patch, code) => assert.throws(() => createOtlpExporter({ ...ok, ...patch }), error => error instanceof OtlpExporterError && error.code === code, JSON.stringify(patch));
  bad({ endpoint: "http://otel.example.com" }, "INVALID_ENDPOINT");
  bad({ endpoint: "https://user:pw@otel.example.com" }, "INVALID_ENDPOINT");
  bad({ endpoint: "https://otel.example.com/?token=1" }, "INVALID_ENDPOINT");
  bad({ endpoint: "not a url" }, "INVALID_ENDPOINT");
  bad({ allowedHosts: [] }, "HOST_NOT_ALLOWED");
  bad({ allowedHosts: ["other.example.com"] }, "HOST_NOT_ALLOWED");
  bad({ endpoint: "https://localhost", allowedHosts: ["localhost"] }, "PRIVATE_ENDPOINT");
  bad({ endpoint: "https://10.0.0.5", allowedHosts: ["10.0.0.5"] }, "PRIVATE_ENDPOINT");
  bad({ transport: undefined }, "TRANSPORT_REQUIRED");
  bad({ headers: { cookie: "x" } }, "HEADER_NOT_ALLOWED");
  bad({ headers: { authorization: "Bearer a\r\nX: y" } }, "HEADER_NOT_ALLOWED");
  assert.equal(createOtlpExporter({ ...ok, endpoint: "http://otel.internal:4318", allowedHosts: ["otel.internal"], allowPrivateEndpoint: true }).enabled, true, "an explicit private opt-in is allowed");
});

test("export batches events, reports partial failure and never throws on a failing collector", async () => {
  const calls = [];
  let n = 0;
  const transport = async request => { calls.push(request); n += 1; if (n === 2) return { status: 503 }; if (n === 3) throw new Error("socket hang up with secret detail"); return { status: 200 }; };
  const exporter = createOtlpExporter({ enabled: true, endpoint: "https://otel.example.com", allowedHosts: ["otel.example.com"], transport, maxBatch: 2, headers: { Authorization: "Bearer collector-token" } });
  const result = await exporter.export(Array.from({ length: 5 }, (_, index) => event({ sequence: index + 1, eventId: `evt_${index}` })));
  assert.deepEqual(result, { status: "partial", exported: 2, failed: 3, batches: 3 });
  assert.equal(calls.length, 3);
  assert.equal(calls[0].url, "https://otel.example.com/v1/logs");
  assert.equal(calls[0].headers.authorization, "Bearer collector-token");
  assert.equal(JSON.stringify(result).includes("secret detail"), false, "transport errors are not echoed");
  const down = createOtlpExporter({ enabled: true, endpoint: "https://otel.example.com", allowedHosts: ["otel.example.com"], transport: async () => { throw new Error("down"); } });
  assert.equal((await down.export([event()])).status, "failed");
  await assert.rejects(down.export("nope"), /array/);
});

test("a slow collector is cut off by the timeout", async () => {
  const exporter = createOtlpExporter({ enabled: true, endpoint: "https://otel.example.com", allowedHosts: ["otel.example.com"], transport: () => new Promise(() => {}), timeoutMs: 20 });
  assert.equal((await exporter.export([event()])).status, "failed");
});

test("the environment factory enables the exporter only with the explicit flag and an allowlist", () => {
  const transport = async () => ({ status: 200 });
  const exporter = createOtlpExporterFromEnv({ HERO_OTEL_EXPORT_ENABLED: "true", HERO_OTEL_ENDPOINT: "https://otel.example.com", HERO_OTEL_ALLOWED_HOSTS: "otel.example.com, other.example.com" }, { transport });
  assert.equal(exporter.enabled, true);
  assert.throws(() => createOtlpExporterFromEnv({ HERO_OTEL_EXPORT_ENABLED: "true", HERO_OTEL_ENDPOINT: "https://otel.example.com" }, { transport }), error => error.code === "HOST_NOT_ALLOWED");
});
