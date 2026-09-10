import { randomUUID } from "node:crypto";

const SAFE_ENV_NAME = /^[A-Z][A-Z0-9_]{2,127}$/;
const DEFAULT_ENDPOINTS = Object.freeze({
  openai: "https://api.openai.com/v1/responses",
  anthropic: "https://api.anthropic.com/v1/messages",
  google: "https://generativelanguage.googleapis.com/v1beta",
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

function resolveCredential({ credentialRef, credentialEnv, env }) {
  if (typeof credentialRef !== "string" || !/^(?:runtime|vault|env):[A-Za-z0-9._:-]{3,120}$/.test(credentialRef)) {
    throw new AiProviderAdapterError("CREDENTIAL_REFERENCE_INVALID", "The runtime credential reference is invalid.");
  }
  const envName = credentialRef.startsWith("env:") ? credentialRef.slice(4) : credentialEnv;
  if (!envName || !SAFE_ENV_NAME.test(envName)) throw new AiProviderAdapterError("CREDENTIAL_NOT_CONFIGURED", "No safe runtime credential resolver is configured.");
  const credential = env[envName];
  if (typeof credential !== "string" || credential.trim() === "") throw new AiProviderAdapterError("CREDENTIAL_NOT_CONFIGURED", "The provider credential is not configured at runtime.");
  return credential;
}

function numberOrZero(value) {
  return Number.isFinite(Number(value)) && Number(value) >= 0 ? Math.floor(Number(value)) : 0;
}

function buildUsage(raw, costCalculator) {
  if (typeof costCalculator !== "function") throw new AiProviderAdapterError("COST_ACCOUNTING_NOT_CONFIGURED", "The provider cost calculator is not configured.");
  const value = raw && typeof raw === "object" ? raw : {};
  const inputTokens = numberOrZero(value.input_tokens ?? value.prompt_tokens ?? value.inputTokens);
  const outputTokens = numberOrZero(value.output_tokens ?? value.completion_tokens ?? value.outputTokens);
  const totalTokens = numberOrZero(value.total_tokens ?? value.totalTokens) || inputTokens + outputTokens;
  const costUnits = costCalculator({ inputTokens, outputTokens, totalTokens });
  if (!Number.isInteger(costUnits) || costUnits < 0 || costUnits > 100_000) {
    throw new AiProviderAdapterError("COST_ACCOUNTING_INVALID", "The provider cost calculator returned an invalid cost.");
  }
  return { inputTokens, outputTokens, totalTokens, costUnits };
}

function createCostCalculator({ costUnitsPer1kTokens, costUnitsPer1kInputTokens, costUnitsPer1kOutputTokens, costCalculator } = {}) {
  if (costCalculator !== undefined) {
    assertFunction("costCalculator", costCalculator);
    return costCalculator;
  }
  const hasSplitRates = costUnitsPer1kInputTokens !== undefined || costUnitsPer1kOutputTokens !== undefined;
  if (hasSplitRates) {
    if (costUnitsPer1kTokens !== undefined || costUnitsPer1kInputTokens === undefined || costUnitsPer1kOutputTokens === undefined) {
      throw new AiProviderAdapterError("ADAPTER_CONFIGURATION_INVALID", "Input and output cost rates must be configured together and cannot be mixed with the legacy total-token rate.");
    }
    for (const [name, value] of [["costUnitsPer1kInputTokens", costUnitsPer1kInputTokens], ["costUnitsPer1kOutputTokens", costUnitsPer1kOutputTokens]]) {
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        throw new AiProviderAdapterError("ADAPTER_CONFIGURATION_INVALID", `${name} must be a non-negative number.`);
      }
    }
    return ({ inputTokens, outputTokens }) => Math.ceil((inputTokens / 1_000) * costUnitsPer1kInputTokens + (outputTokens / 1_000) * costUnitsPer1kOutputTokens);
  }
  if (costUnitsPer1kTokens === undefined) return null;
  if (typeof costUnitsPer1kTokens !== "number" || !Number.isFinite(costUnitsPer1kTokens) || costUnitsPer1kTokens < 0) {
    throw new AiProviderAdapterError("ADAPTER_CONFIGURATION_INVALID", "costUnitsPer1kTokens must be a non-negative number.");
  }
  return ({ totalTokens }) => Math.ceil((totalTokens / 1_000) * costUnitsPer1kTokens);
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

function createHttpAdapter({ providerId, endpoint, credentialEnv, credentialResolver, env = process.env, fetchImpl = globalThis.fetch, costCalculator, costUnitsPer1kTokens, costUnitsPer1kInputTokens, costUnitsPer1kOutputTokens, buildRequest, parseResponse }) {
  if (typeof providerId !== "string" || providerId.length < 3) throw new AiProviderAdapterError("ADAPTER_CONFIGURATION_INVALID", "providerId is required.");
  const normalizedEndpoint = assertEndpoint(endpoint);
  const configuredCredentialEnv = credentialEnv ? assertCredentialEnv(credentialEnv) : null;
  assertFetch(fetchImpl);
  const calculateCost = createCostCalculator({ costCalculator, costUnitsPer1kTokens, costUnitsPer1kInputTokens, costUnitsPer1kOutputTokens });
  const resolve = credentialResolver ?? ((ref) => resolveCredential({ credentialRef: ref, credentialEnv: configuredCredentialEnv, env }));
  assertFunction("credentialResolver", resolve);

  async function credentialFor(input) {
    const value = await resolve(input.credentialRef);
    if (typeof value !== "string" || value.trim() === "") throw new AiProviderAdapterError("CREDENTIAL_NOT_CONFIGURED", "The provider credential is not configured at runtime.");
    return value;
  }

  async function assertDispatchReady(input) {
    if (!calculateCost) throw new AiProviderAdapterError("COST_ACCOUNTING_NOT_CONFIGURED", "Live provider dispatch requires cost accounting.");
    await credentialFor(input);
    if (!Number.isInteger(input.maxOutputTokens) || input.maxOutputTokens < 1 || !Number.isInteger(input.maxCostUnits) || input.maxCostUnits < 1) {
      throw new AiProviderAdapterError("COST_POLICY_INVALID", "Live provider dispatch requires positive output-token and cost limits.");
    }
    const inputTokenUpperBound = Buffer.byteLength(inputEnvelope(input), "utf8") + 512;
    const worstCaseCostUnits = calculateCost({ inputTokens: inputTokenUpperBound, outputTokens: input.maxOutputTokens, totalTokens: inputTokenUpperBound + input.maxOutputTokens });
    if (!Number.isInteger(worstCaseCostUnits) || worstCaseCostUnits < 0 || worstCaseCostUnits > input.maxCostUnits) {
      throw new AiProviderAdapterError("COST_POLICY_INSUFFICIENT", "The configured invocation cap does not cover the conservative worst-case token budget.");
    }
    return copy({ providerId, endpoint: normalizedEndpoint, costAccounting: true, maxOutputTokens: input.maxOutputTokens, worstCaseCostUnits });
  }

  async function generate(input) {
    const credential = await credentialFor(input);
    const request = buildRequest({ input, endpoint: normalizedEndpoint, credential });
    let response;
    try {
      response = await fetchImpl(request.url, request.options);
    } catch {
      throw new AiProviderAdapterError("PROVIDER_NETWORK_ERROR", "The provider network request failed.", { retryable: true });
    }
    const body = await readResponse(response);
    const output = parseStructuredText(parseResponse.text(body));
    return copy({ output, usage: buildUsage(parseResponse.usage(body), calculateCost), providerRequestId: typeof body?.id === "string" ? body.id : null });
  }

  async function validateConnection() {
    if (!calculateCost) throw new AiProviderAdapterError("COST_ACCOUNTING_NOT_CONFIGURED", "Live provider health requires cost accounting.");
    await resolve(credentialEnv ? `env:${credentialEnv}` : "env:placeholder").catch(error => { throw error; });
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
    listCapabilities: () => Object.freeze(["structured-json", "usage-accounting", "runtime-credentials"]),
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
    "openai-compatible": createOpenAiCompatibleAdapter(options["openai-compatible"])
  });
}
