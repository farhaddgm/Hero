import assert from "node:assert/strict";
import test from "node:test";

import { evaluateAiAdvisorReadiness } from "../packages/domain/src/ai-advisor-readiness.mjs";

const provider = { providerId: "openai", mode: "live", advisorCompatible: true };
const model = { providerId: "openai", modelId: "gpt-5.6-luna" };
const profile = { profileId: "openai-analyst-v1", status: "active", role: "analyst", outputSchema: "analysis-v1", toolPolicy: "read-only" };
const binding = { projectId: "hero", role: "analyst", profileId: profile.profileId };
const health = { status: "healthy", code: "PROVIDER_HEALTHY" };
const authorization = { authorized: true, code: "AUTHORIZED", expiresAtMs: Number.POSITIVE_INFINITY };

test("advisor readiness is selectable only when every live gate agrees", () => {
  const result = evaluateAiAdvisorReadiness({
    purpose: "smart-tester",
    projectId: "hero",
    provider,
    model,
    profile,
    binding,
    projectScope: { projectId: "hero", mode: "enabled", capabilities: ["smart-tester"] },
    health,
    authorization
  });
  assert.equal(result.selectable, true);
  assert.equal(result.code, "ADVISOR_READY");
  assert.equal(result.blockingReasons.length, 0);
  assert.ok(result.checks.every(item => item.passed));
});

test("advisor readiness reports the real blocking gate without exposing secrets", () => {
  const result = evaluateAiAdvisorReadiness({
    purpose: "form-suggestions",
    projectId: "hero",
    provider,
    model,
    profile,
    binding,
    projectScope: { projectId: "hero", mode: "local-only", capabilities: ["smart-tester"] },
    health,
    authorization: { authorized: false, code: "LIVE_ADVISOR_AUTHORIZATION_SCOPE_MISMATCH", expiresAtMs: 0 }
  });
  assert.equal(result.selectable, false);
  assert.equal(result.code, "AI_PROJECT_SCOPE_DISABLED");
  assert.deepEqual(result.blockingReasons.map(item => item.code), ["AI_PROJECT_SCOPE_DISABLED", "LIVE_ADVISOR_AUTHORIZATION_SCOPE_MISMATCH"]);
  assert.doesNotMatch(JSON.stringify(result), /(?:credential|secret|api[_ -]?key|Bearer|sk-[A-Za-z0-9])/i);
});

test("a local advisor remains selectable without external authorization", () => {
  const result = evaluateAiAdvisorReadiness({
    purpose: "walkthrough-guide",
    projectId: "hero",
    provider: { providerId: "deterministic", mode: "deterministic", advisorCompatible: true },
    model: { providerId: "deterministic", modelId: "local-advisor-v1" },
    profile: { ...profile, providerId: "deterministic", modelId: "local-advisor-v1" },
    binding,
    health: { status: "healthy", code: "LOCAL_PROVIDER_READY" },
    authorization: { authorized: true, code: "LOCAL_PROVIDER", expiresAtMs: Number.POSITIVE_INFINITY }
  });
  assert.equal(result.selectable, true);
});
