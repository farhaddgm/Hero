export const PERFORMANCE_INTELLIGENCE_CONTRACT_VERSION = "1.0";
export const USAGE_EVENT_FIELDS = Object.freeze(["inputTokens", "cachedTokens", "outputTokens", "totalTokens"]);
export const HEALTH_STATUSES = Object.freeze(["unknown", "healthy", "degraded", "critical"]);
export function getPerformanceIntelligenceContractSummary() { return Object.freeze({ version: PERFORMANCE_INTELLIGENCE_CONTRACT_VERSION, usageFields: USAGE_EVENT_FIELDS, health: "versioned formula with confidence/freshness and critical overrides", cost: "token usage only; external-provider monetary accounting remains separate" }); }
export function validatePerformanceIntelligenceContract() { return PERFORMANCE_INTELLIGENCE_CONTRACT_VERSION === "1.0" && USAGE_EVENT_FIELDS.length === 4 ? [] : ["Invalid performance intelligence contract."]; }
