import { randomUUID } from "node:crypto";

import { createPricingCostAccounting, PricingCatalogError } from "./pricing-catalog.mjs";

const SAFE_ENV_NAME = /^[A-Z][A-Z0-9_]{2,127}$/;
const DEFAULT_ENDPOINTS = Object.freeze({
  openai: "https://api.openai.com/v1/responses",
  anthropic: "https://api.anthropic.com/v1/messages",
  google: "https://generativelanguage.googleapis.com/v1beta",
  cursor: "https://api.cursor.com",
  "openai-compatible": "http://127.0.0.1:43101/v1/chat/completions"
});

function copy(value) {
  return Object.freeze(structuredClone(value));
}

function assertFunction(label, value) {
  if (typeof value !== "function") throw new AiProviderAdapterError("ADAPTER_CONFIGURATION_INVALID", `${label} must be a function.`);
  return value;
}

function assertEndpoint(value) {
  let url;
  try { url = new URL(value); } catch { throw new AiProviderAdapterError("ADAPTER_CONFIGURATION_INVALID", "Provider endpoint must be an absolute URL."); }
  if (!['https:', 'http:'].includes(url.protocol)) throw new AiProviderAdapterError("ADAPTER_CONFIGURATION_INVALID", "Provider endpoint protocol is not supported.");
  if (url.username || url.password || url.search || url.hash) throw new AiProviderAdapterError("ADAPTER_CONFIGURATION_INVALID", "Provider endpoint must not contain credentials or query values.");
  if (url.protocol === "http:" && !['127.0.0.1', 'localhost'].includes(url.hostname)) {
    throw new AiProviderAdapterError("ADAPTER_CONFIGURATION_INVALID", "Non-local provider endpoints must use HTTPS.");
  }
  return value.replace(/\/$/, "");
}

function assertCredentialEnv(value) {
  if (typeof value !== "string" || !SAFE_ENV_NAME.test(value)) throw new AiProviderAdapterError("ADAPTER_CONFIGURATION_INVALID", "credentialEnv must be a safe environment variable name.");
  return value;
}

function isSafeCredentialReference(value) {
  if (typeof value !== "string") return false;
  if (/^(?:runtime|env):[A-Za-z0-9._:-]{3,120}$/.test(value)) return true;
  if (!value.startsWith("vault:")) return false;
  const segments = value.slice("vault:".length).split("/");
  return segments.length >= 2
    && segments.length <= 5
    && value.length <= 160
    && segments.every(segment => /^[A-Za-z0-9._:-]{1,80}$/.test(segment) && segment !== "." && segment !== "..");
}

function resolveCredential({ credentialRef, credentialEnv, env }) {
  if (!isSafeCredentialReference(credentialRef)) {
    throw new AiProviderAdapterError("CREDENTIAL_REFERENCE_INVALID", "The runtime credential reference is invalid.");
  }
  const envName = credentialRef.startsWith("env:") ? credentialRef.slice(4) : credentialEnv;
  if (!envName || !SAFE_ENV_NAME.test(envName)) throw new AiProviderAdapterError("CREDENTIAL_NOT_CONFIGURED", "No safe runtime credential resolver is configured.");
  const credential = env[envName];
  if (typeof credential !== "string" || credential.trim() === "") throw new AiProviderAdapterError("CREDENTIAL_NOT_CONFIGURED", "The provider credential is not configured at runtime.");
  return credential;
}

function usageInteger(value, label, { optional = false } = {}) {
  if (value === undefined || value === null) {
    if (optional) return 0;
    throw new AiProviderAdapterError("USAGE_INVALID", `Provider usage.${label} is required for cost accounting.`);
  }
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new AiProviderAdapterError("USAGE_INVALID", `Provider usage.${label} must be a non-negative safe integer.`);
  }
  return value;
}

function buildUsage(raw, costAccounting) {
  if (!costAccounting || typeof costAccounting.estimate !== "function") throw new AiProviderAdapterError("COST_ACCOUNTING_NOT_CONFIGURED", "The provider pricing catalog is not configured.");
  const value = raw && typeof raw === "object" ? raw : {};
  const inputTokens = usageInteger(value.input_tokens ?? value.prompt_tokens ?? value.inputTokens, "inputTokens");
  const outputTokens = usageInteger(value.output_tokens ?? value.completion_tokens ?? value.outputTokens, "outputTokens");
  const cachedInputTokens = usageInteger(value.cached_input_tokens ?? value.cachedInputTokens ?? value.prompt_tokens_details?.cached_tokens ?? value.input_token_details?.cached_tokens, "cachedInputTokens", { optional: true });
  const reportedTotal = value.total_tokens ?? value.totalTokens;
  const totalTokens = reportedTotal === undefined || reportedTotal === null
    ? inputTokens + outputTokens
    : usageInteger(reportedTotal, "totalTokens");
  if (totalTokens < inputTokens + outputTokens) throw new AiProviderAdapterError("USAGE_INVALID", "Provider usage.totalTokens cannot be lower than input plus output tokens.");
  const estimate = costAccounting.estimate({ inputTokens, outputTokens, cachedInputTokens, totalTokens });
  const costUnits = estimate.costUnits;
  if (!Number.isInteger(costUnits) || costUnits < 0 || costUnits > 100_000) {
    throw new AiProviderAdapterError("COST_ACCOUNTING_INVALID", "The provider cost calculator returned an invalid cost.");
  }
  return { inputTokens, outputTokens, cachedInputTokens, totalTokens, costUnits, pricing: estimate.pricing };
}

function createLegacyTestAccounting(costCalculator) {
  assertFunction("costCalculator", costCalculator);
  return Object.freeze({
    estimate(usage) {
      const costUnits = costCalculator(usage);
      if (!Number.isInteger(costUnits) || costUnits < 0 || costUnits > 100_000) throw new AiProviderAdapterError("COST_ACCOUNTING_INVALID", "The provider cost calculator returned an invalid cost.");
      return { costUnits, pricing: null };
    },
    estimateWorstCase(usage) {
      return this.estimate(usage);
    }
  });
}

function extractText(body) {
  if (typeof body?.output_text === "string") return body.output_text;
  if (Array.isArray(body?.output)) {
    const text = body.output.flatMap(item => Array.isArray(item?.content) ? item.content : []).map(item => item?.text).find(value => typeof value === "string");
    if (text) return text;
  }
  if (Array.isArray(body?.content)) {
    const text = body.content.map(item => item?.text).find(value => typeof value === "string");
    if (text) return text;
  }
  if (typeof body?.choices?.[0]?.message?.content === "string") return body.choices[0].message.content;
  if (typeof body?.candidates?.[0]?.content?.parts?.[0]?.text === "string") return body.candidates[0].content.parts[0].text;
  return null;
}

function parseStructuredText(text) {
  if (typeof text !== "string" || text.trim() === "") throw new AiProviderAdapterError("PROVIDER_OUTPUT_EMPTY", "The provider returned no structured output.", { retryable: false });
  const normalized = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const value = JSON.parse(normalized);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("not an object");
    return value;
  } catch {
    throw new AiProviderAdapterError("PROVIDER_OUTPUT_NOT_JSON", "The provider output was not valid JSON.", { retryable: false });
  }
}

function redactCredential(value, credential) {
  if (typeof value === "string") return credential ? value.split(credential).join("[redacted]") : value;
  if (Array.isArray(value)) return value.map(item => redactCredential(item, credential));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, redactCredential(child, credential)]));
  }
  return value;
}

async function readResponse(response) {
  let body = null;
  try { body = await response.json(); } catch { body = null; }
  if (!response.ok) {
    const status = Number(response.status) || 0;
    throw new AiProviderAdapterError("PROVIDER_HTTP_ERROR", `Provider request failed with HTTP ${status}.`, { retryable: status === 408 || status === 409 || status === 429 || status >= 500 });
  }
  return body ?? {};
}

function inputEnvelope(input) {
  return JSON.stringify({
    request: input.request,
    context: input.context,
    role: input.role,
    outputSchema: input.outputSchema,
    instruction: "Return only a JSON object whose schema field exactly matches outputSchema. Do not include credentials, host paths, or tool calls."
  });
}

function assertFetch(fetchImpl) {
  if (typeof fetchImpl !== "function") throw new AiProviderAdapterError("FETCH_UNAVAILABLE", "A fetch implementation is required for a live provider adapter.");
}

export class AiProviderAdapterError extends Error {
  constructor(code, message, { retryable = false } = {}) {
    super(message);
    this.name = "AiProviderAdapterError";
    this.code = code;
    this.retryable = retryable;
  }
}

function createHttpAdapter({ providerId, endpoint, credentialEnv, credentialResolver, env = process.env, fetchImpl = globalThis.fetch, pricingCatalog, costCalculator, costUnitsPer1kTokens, costUnitsPer1kInputTokens, costUnitsPer1kOutputTokens, buildRequest, parseResponse }) {
  if (typeof providerId !== "string" || providerId.length < 3) throw new AiProviderAdapterError("ADAPTER_CONFIGURATION_INVALID", "providerId is required.");
  const normalizedEndpoint = assertEndpoint(endpoint);
  const configuredCredentialEnv = credentialEnv ? assertCredentialEnv(credentialEnv) : null;
  assertFetch(fetchImpl);
  if (costUnitsPer1kTokens !== undefined || costUnitsPer1kInputTokens !== undefined || costUnitsPer1kOutputTokens !== undefined) {
    throw new AiProviderAdapterError("LEGACY_MANUAL_PRICING_DISABLED", "Manual provider pricing rates are disabled; use a versioned Pricing Catalog.");
  }
  if (pricingCatalog && costCalculator !== undefined) throw new AiProviderAdapterError("ADAPTER_CONFIGURATION_INVALID", "Pricing Catalog and manual cost calculator cannot be combined.");
  const legacyAccounting = costCalculator === undefined ? null : createLegacyTestAccounting(costCalculator);
  const resolve = credentialResolver ?? ((ref) => resolveCredential({ credentialRef: ref, credentialEnv: configuredCredentialEnv, env }));
  assertFunction("credentialResolver", resolve);

  function costAccountingFor(input) {
    if (legacyAccounting) return legacyAccounting;
    if (!pricingCatalog) throw new AiProviderAdapterError("COST_ACCOUNTING_NOT_CONFIGURED", "Live provider dispatch requires a versioned Pricing Catalog.");
    try {
      return createPricingCostAccounting({ catalog: pricingCatalog, providerId, modelId: input.modelId });
    } catch (error) {
      if (error instanceof PricingCatalogError) throw new AiProviderAdapterError(error.code, error.message);
      throw error;
    }
  }

  async function credentialFor(input) {
    const value = await resolve(input.credentialRef);
    if (typeof value !== "string" || value.trim() === "") throw new AiProviderAdapterError("CREDENTIAL_NOT_CONFIGURED", "The provider credential is not configured at runtime.");
    return value;
  }

  async function assertDispatchReady(input) {
    const costAccounting = costAccountingFor(input);
    await credentialFor(input);
    if (!Number.isInteger(input.maxOutputTokens) || input.maxOutputTokens < 1 || !Number.isInteger(input.maxCostUnits) || input.maxCostUnits < 1) {
      throw new AiProviderAdapterError("COST_POLICY_INVALID", "Live provider dispatch requires positive output-token and cost limits.");
    }
    const inputTokenUpperBound = Buffer.byteLength(inputEnvelope(input), "utf8") + 512;
    const estimate = costAccounting.estimateWorstCase({ inputTokens: inputTokenUpperBound, outputTokens: input.maxOutputTokens, cachedInputTokens: 0 });
    const worstCaseCostUnits = estimate.costUnits;
    if (!Number.isInteger(worstCaseCostUnits) || worstCaseCostUnits < 0 || worstCaseCostUnits > input.maxCostUnits) {
      throw new AiProviderAdapterError("COST_POLICY_INSUFFICIENT", "The configured invocation cap does not cover the conservative worst-case token budget.");
    }
    return copy({ providerId, endpoint: normalizedEndpoint, costAccounting: true, maxOutputTokens: input.maxOutputTokens, worstCaseCostUnits, pricing: estimate.pricing });
  }

  async function generate(input) {
    const readiness = await assertDispatchReady(input);
    const credential = await credentialFor(input);
    const request = buildRequest({ input, endpoint: normalizedEndpoint, credential });
    let response;
    const timeoutMs = Number.isInteger(input.timeoutMs) && input.timeoutMs >= 100 && input.timeoutMs <= 600_000
      ? input.timeoutMs
      : 120_000;
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      const options = controller
        ? { ...request.options, signal: request.options?.signal ?? controller.signal }
        : request.options;
      response = await fetchImpl(request.url, options);
    } catch (error) {
      if (controller?.signal.aborted || error?.name === "AbortError") {
        throw new AiProviderAdapterError("PROVIDER_TIMEOUT", `Provider did not respond within ${timeoutMs}ms.`, { retryable: true });
      }
      throw new AiProviderAdapterError("PROVIDER_NETWORK_ERROR", "The provider network request failed.", { retryable: true });
    } finally {
      if (timer) clearTimeout(timer);
    }
    const body = await readResponse(response);
    const output = redactCredential(parseStructuredText(parseResponse.text(body)), credential);
    return copy({ output, usage: buildUsage(parseResponse.usage(body), costAccountingFor(input)), providerRequestId: typeof body?.id === "string" ? body.id : null, pricing: readiness.pricing });
  }

  async function validateConnection(input = {}) {
    if (!pricingCatalog && !legacyAccounting) throw new AiProviderAdapterError("COST_ACCOUNTING_NOT_CONFIGURED", "Live provider health requires a versioned Pricing Catalog.");
    const credentialRef = typeof input?.credentialRef === "string" && input.credentialRef.trim()
      ? input.credentialRef.trim()
      : (credentialEnv ? `env:${credentialEnv}` : "env:placeholder");
    // Credential resolvers may be synchronous (environment/local stores) or
    // asynchronous (remote Secret Managers); normalize both contracts here.
    await Promise.resolve(resolve(credentialRef));
    return copy({ status: "ok", providerId, mode: "configured-no-network-health-check" });
  }

  return Object.freeze({
    providerId,
    mode: "live",
    endpoint: normalizedEndpoint,
    credentialEnv: configuredCredentialEnv,
    assertDispatchReady,
    generate,
    validateConnection,
    listCapabilities: () => Object.freeze(["structured-json", "usage-accounting", "runtime-credentials", ...(pricingCatalog ? ["versioned-pricing-catalog"] : [])]),
    adapterId: `hero-live-${providerId}-${randomUUID().slice(0, 8)}`
  });
}

export function createOpenAiResponsesAdapter(options = {}) {
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINTS.openai;
  return createHttpAdapter({
    ...options,
    providerId: "openai",
    endpoint,
    credentialEnv: options.credentialEnv ?? "HERO_OPENAI_API_KEY",
    buildRequest: ({ input, endpoint: url, credential }) => ({
      url,
      options: {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${credential}` },
        body: JSON.stringify({
          model: input.modelId,
          store: false,
          max_output_tokens: input.maxOutputTokens,
          input: [{ role: "user", content: [{ type: "input_text", text: inputEnvelope(input) }] }],
          text: { format: { type: "json_object" } }
        })
      }
    }),
    parseResponse: { text: extractText, usage: body => body?.usage }
  });
}

export function createAnthropicMessagesAdapter(options = {}) {
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINTS.anthropic;
  return createHttpAdapter({
    ...options,
    providerId: "anthropic",
    endpoint,
    credentialEnv: options.credentialEnv ?? "HERO_ANTHROPIC_API_KEY",
    buildRequest: ({ input, endpoint: url, credential }) => ({
      url,
      options: {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": credential, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: input.modelId, max_tokens: input.maxOutputTokens ?? 4096, messages: [{ role: "user", content: inputEnvelope(input) }] })
      }
    }),
    parseResponse: { text: extractText, usage: body => ({ input_tokens: body?.usage?.input_tokens, output_tokens: body?.usage?.output_tokens }) }
  });
}

export function createGoogleGeminiAdapter(options = {}) {
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINTS.google;
  return createHttpAdapter({
    ...options,
    providerId: "google",
    endpoint,
    credentialEnv: options.credentialEnv ?? "HERO_GOOGLE_API_KEY",
    buildRequest: ({ input, endpoint: url, credential }) => ({
      url: `${url}/models/${encodeURIComponent(input.modelId)}:generateContent`,
      options: {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": credential },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: inputEnvelope(input) }] }], generationConfig: { responseMimeType: "application/json", maxOutputTokens: input.maxOutputTokens } })
      }
    }),
    parseResponse: { text: extractText, usage: body => ({ input_tokens: body?.usageMetadata?.promptTokenCount, output_tokens: body?.usageMetadata?.candidatesTokenCount, total_tokens: body?.usageMetadata?.totalTokenCount }) }
  });
}

/**
 * Cursor is connected as a managed coding-agent platform rather than being
 * misrepresented as an OpenAI-compatible chat endpoint.  The current Hero
 * orchestration contract can safely verify that its runtime credential and
 * pricing boundary are ready, but dispatching a Cursor Cloud Agent requires a
 * repository-scoped, separately authorised workflow.  Keeping that boundary
 * explicit lets the Back Office show and test the connection without turning a
 * guide/chat selection into an unexpected code-writing external operation.
 */
export function createCursorCloudAgentAdapter(options = {}) {
  const providerId = "cursor";
  const endpoint = assertEndpoint(options.endpoint ?? DEFAULT_ENDPOINTS.cursor);
  const credentialEnv = options.credentialEnv ?? "HERO_CURSOR_API_KEY";
  const configuredCredentialEnv = assertCredentialEnv(credentialEnv);
  const env = options.env ?? process.env;
  const resolve = options.credentialResolver ?? (ref => resolveCredential({ credentialRef: ref, credentialEnv: configuredCredentialEnv, env }));
  assertFunction("credentialResolver", resolve);
  const pricingCatalog = options.pricingCatalog;

  async function validateConnection(input = {}) {
    if (!pricingCatalog) throw new AiProviderAdapterError("COST_ACCOUNTING_NOT_CONFIGURED", "Cursor readiness requires a versioned Pricing Catalog.");
    const credentialRef = typeof input?.credentialRef === "string" && input.credentialRef.trim()
      ? input.credentialRef.trim()
      : `env:${configuredCredentialEnv}`;
    await Promise.resolve(resolve(credentialRef));
    return copy({ status: "ok", providerId, mode: "configured-no-network-health-check" });
  }

  async function assertDispatchReady() {
    throw new AiProviderAdapterError("CURSOR_AGENT_WORKFLOW_REQUIRED", "Cursor Cloud Agent dispatch requires a repository-scoped workflow and separate external authorization.");
  }

  async function generate() {
    throw new AiProviderAdapterError("CURSOR_AGENT_WORKFLOW_REQUIRED", "Cursor is not a direct chat provider in Hero. Use its separately authorized coding-agent workflow.");
  }

  return Object.freeze({
    providerId,
    mode: "live",
    endpoint,
    credentialEnv: configuredCredentialEnv,
    validateConnection,
    assertDispatchReady,
    generate,
    listCapabilities: () => Object.freeze(["cursor-cloud-agent", "runtime-credentials", "connection-readiness-only", "repository-scoped-dispatch"]),
    adapterId: `hero-live-cursor-${randomUUID().slice(0, 8)}`
  });
}

export function createOpenAiCompatibleAdapter(options = {}) {
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINTS["openai-compatible"];
  return createHttpAdapter({
    ...options,
    providerId: "openai-compatible",
    endpoint,
    credentialEnv: options.credentialEnv ?? "HERO_OPENAI_COMPATIBLE_API_KEY",
    buildRequest: ({ input, endpoint: url, credential }) => ({
      url,
      options: {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${credential}` },
        body: JSON.stringify({ model: input.modelId, max_tokens: input.maxOutputTokens, messages: [{ role: "user", content: inputEnvelope(input) }], response_format: { type: "json_object" } })
      }
    }),
    parseResponse: { text: extractText, usage: body => body?.usage }
  });
}

export function createConfiguredAiProviderAdapters(options = {}) {
  return Object.freeze({
    openai: createOpenAiResponsesAdapter(options.openai),
    anthropic: createAnthropicMessagesAdapter(options.anthropic),
    google: createGoogleGeminiAdapter(options.google),
    cursor: createCursorCloudAgentAdapter(options.cursor),
    "openai-compatible": createOpenAiCompatibleAdapter(options["openai-compatible"])
  });
}
