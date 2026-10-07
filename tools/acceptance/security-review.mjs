// BO-152: an executable security review of Hero's own HTTP surface. It exercises
// authentication, authorization, object-level access, upload handling, AI tool
// and Node Agent boundaries against a live instance and counts every check.
import { createRecorder } from "./audit-lib.mjs";

const digest = character => `sha256:${character.repeat(64)}`;

export async function runSecurityReview(fixture, { project = "project-alpha", other = "project-beta", commandId = "cmd-fixture-1", correlationId = "corr-fixture-1" } = {}) {
  const { call, base, tokens } = fixture; const recorder = createRecorder("tools/audit/security-review");
  const status = async (who, method, route, body, headers) => (await call(who, method, route, body, headers)).status;
  const denied = code => code === 401 || code === 403;
  const root = `/api/projects/${project}`;

  // ---- authentication ----
  const anonymousRoutes = [["GET", `${root}/notifications`], ["GET", `${root}/audit-log`], ["GET", `${root}/hardening`], ["GET", `${root}/slo`], ["GET", `${root}/final-readiness`], ["GET", `${root}/infrastructure`], ["GET", `${root}/delivery`], ["GET", `${root}/catalog`], ["GET", `${root}/ledger`], ["GET", `${root}/correlations/${correlationId}`], ["POST", `${root}/commands`], ["POST", `${root}/notifications`], ["POST", `${root}/audit-log/export`], ["POST", `${root}/hardening`], ["GET", "/api/ai/credentials"], ["GET", "/api/identity/users"]];
  // An instance with no owner secret fails closed with 503 OWNER_AUTH_NOT_CONFIGURED (a deliberate misconfiguration signal); one with it answers 401. Both refuse, nothing else is accepted.
  const refusedAnonymously = async response => { if (response.status === 401) return true; if (response.status !== 503) return false; try { return (await response.json()).code === "OWNER_AUTH_NOT_CONFIGURED"; } catch { return false; } };
  for (const [method, route] of anonymousRoutes) { const response = await fetch(`${base}${route}`, { method, headers: { "content-type": "application/json", ...(method === "GET" ? {} : { origin: base }) }, body: method === "GET" ? undefined : "{}" }); recorder.check(`unauthenticated ${method} ${route.replace(root, "")} is refused`, await refusedAnonymously(response), response.status); }
  for (const bad of ["Bearer not-a-token", `Bearer ${tokens.admin.slice(0, -2)}xx`, "Basic YWRtaW46YWRtaW4=", "Bearer "]) { const response = await fetch(`${base}${root}/notifications`, { headers: { authorization: bad } }); recorder.check(`a forged credential (${bad.slice(0, 14)}…) is refused`, await refusedAnonymously(response), response.status); }
  const cookie = `__Host-hero-human-session=${encodeURIComponent(tokens.admin)}`;
  for (const [label, headers] of [["a foreign Origin", { origin: "https://evil.example" }], ["no Origin", {}]]) { const response = await fetch(`${base}${root}/notifications`, { method: "POST", headers: { cookie, "content-type": "application/json", ...headers }, body: JSON.stringify({ category: "health", severity: "info", title: "csrf probe", deduplicationKey: "csrf-probe", correlationId: "corr-csrf" }) }); recorder.check(`a cookie-authenticated write with ${label} is refused`, denied(response.status), response.status); }
  recorder.check("a request body over the limit is refused with 413", [413].includes(await status("admin", "POST", `${root}/notifications`, { category: "health", severity: "info", title: "x".repeat(40_000), deduplicationKey: "big", correlationId: "corr-big" })));

  // ---- authorization: a viewer can read but never write ----
  const viewerWrites = [["POST", `${root}/commands`, { commandId: "cmd-evil-1", action: "deploy.test", risk: "medium", correlationId: "corr-evil", idempotencyKey: "idem-evil" }], ["POST", `${root}/commands/${commandId}/approve`, {}], ["POST", `${root}/notifications`, { category: "health", severity: "info", title: "evil", deduplicationKey: "evil", correlationId: "corr-evil" }], ["POST", `${root}/slo`, { projection: "portfolio", lagSeconds: 1, freshnessSeconds: 1 }], ["POST", `${root}/hardening`, { action: "set-retention", retention: { auditDays: 400 } }], ["POST", `${root}/hardening`, { action: "place-hold", targetId: "audit-1", reason: "evil" }], ["POST", `${root}/final-readiness`, { action: "plan-migration" }], ["POST", `${root}/budget`, { softThreshold: 1, hardCap: 2 }], ["POST", `${root}/usage`, { usageId: "usage-evil", invocationId: "invoke-evil", provider: "openai", model: "sol" }], ["POST", `${root}/catalog`, { entityId: "evil-entity", type: "service", name: "Evil" }], ["POST", `${root}/infrastructure`, { action: "register-repository", repositoryId: "repo-evil", name: "x" }], ["POST", `${root}/delivery`, { action: "create-release", releaseId: "release-evil", testedCommit: "abc1234" }], ["POST", `${root}/feedback`, { feedbackId: "fb-evil", subjectId: "release-evil", subjectKind: "release" }], ["POST", `${root}/inputs/link`, { url: "https://example.com", label: "evil" }]];
  for (const [method, route, body] of viewerWrites) recorder.check(`viewer ${method} ${route.replace(root, "")} is refused`, await status("viewer", method, route, body) === 403);

  // ---- authorization: an admin cannot do owner-only things ----
  const ownerOnly = [["POST", `${root}/audit-log/export`, { reason: "evil export" }], ["POST", `${root}/retention`, { stream: "activity", days: 90, reason: "evil" }], ["POST", `${root}/hardening`, { action: "release-hold", targetId: "audit-1", reason: "evil" }], ["POST", `${root}/hardening/cleanup/cleanup-x/execute`, { reason: "evil" }], ["POST", `${root}/final-readiness`, { action: "accept", reviewId: "review-x", artifactIdentity: "artifact-identity-1" }], ["POST", `${root}/final-readiness`, { action: "pilot-proposal", proposalId: "pilot-x", reviewId: "review-x", scope: "evil" }], ["POST", "/api/identity/users", { userId: "evil-user", email: "evil@example.test", displayName: "evil", password: "Evil password 123" }], ["POST", `/api/projects/${project}/archive`, { expectedVersion: 1 }], ["DELETE", `/api/projects/${project}`, { expectedVersion: 1, confirmation: project }], ["POST", `${root}/access`, { userId: "viewer-user", role: "admin" }], ["POST", "/api/operations/heavy-run-limit", { limit: 20 }], ["GET", "/api/ai/credentials", undefined], ["POST", `${root}/budget/resume`, { reason: "evil" }]];
  for (const [method, route, body] of ownerOnly) recorder.check(`admin ${method} ${route.replace(root, "")} is refused`, denied(await status("admin", method, route, body)), route);
  recorder.check("an admin gets the same 403 whether or not the target user exists (no user or MFA oracle)", (await status("admin", "POST", `${root}/access`, { userId: "ghost-user-zz", role: "admin" })) === 403 && (await status("admin", "POST", `${root}/access/revoke`, { userId: "ghost-user-zz" })) === 403);
  recorder.check("an admin cannot raise the budget cap above what the owner set", (await status("admin", "POST", `${root}/budget`, { softThreshold: 5000, hardCap: 9000 })) === 403);

  // ---- cross-project (object-level) ----
  const crossReads = ["notifications", "incidents", "audit-log", "timeline", "slo", "hardening", "retention-policy", "final-readiness", "infrastructure", "delivery", "catalog", "ledger", "budget", "health", "operations", "observability"];
  for (const who of ["admin", "viewer"]) for (const resource of crossReads) recorder.check(`${who} cannot read ${other}/${resource}`, await status(who, "GET", `/api/projects/${other}/${resource}`) === 403, resource);
  recorder.check("a command id from another project is not reachable", await status("owner", "GET", `/api/projects/${other}/commands/${commandId}`) === 404);
  recorder.check("a command id from another project cannot be approved through its own route", await status("owner", "POST", `/api/projects/${other}/commands/${commandId}/approve`, {}) === 404);
  const alphaNotifications = (await call("viewer", "GET", `${root}/notifications`)).body?.notifications ?? [];
  recorder.check("a notification id from another project cannot be acted on", await status("owner", "POST", `/api/projects/${other}/notifications/${alphaNotifications[0]?.notificationId ?? "notification-none"}/act`, { action: "acknowledge" }) === 404);
  const otherCorrelation = (await call("owner", "GET", `/api/projects/${other}/correlations/${correlationId}`)).body?.correlation;
  recorder.check("a correlation id from another project reveals nothing", (otherCorrelation?.commands?.length ?? 1) === 0 && (otherCorrelation?.notifications?.length ?? 1) === 0);
  recorder.check("a command created in one project cannot cite another project's source", (await call("owner", "POST", `/api/projects/${other}/commands`, { commandId: "cmd-cross-source", action: "deploy.test", risk: "medium", correlationId: "corr-cross", idempotencyKey: "idem-cross", sourceRef: `hero://projects/${project}/conversations/x/messages/y` })).status === 403);

  // ---- upload ----
  const upload = (who, body) => status(who, "POST", `${root}/inputs/upload`, body);
  recorder.check("an upload with a path-traversal filename is refused", (await upload("admin", { type: "text", filename: "../../etc/passwd", content: "x", mimeType: "text/plain" })) >= 400);
  recorder.check("an executable upload is refused", (await upload("admin", { type: "file", filename: "run.exe", content: "MZ", mimeType: "application/x-msdownload" })) >= 400);
  recorder.check("a viewer cannot upload", await upload("viewer", { type: "text", filename: "note.txt", content: "hello", mimeType: "text/plain" }) === 403);
  recorder.check("a zip that expands beyond the limit is refused", (await upload("admin", { type: "file", filename: "bomb.zip", content: "UEsDBA==", mimeType: "application/zip", zipExpandedBytes: 5_000_000_000 })) >= 400);

  // ---- AI tool boundaries ----
  for (const [method, route] of [["GET", "/api/smart-tester/status"], ["POST", "/api/smart-tester/errors/submit"]]) recorder.check(`admin cannot use the Smart Tester (${route})`, denied(await status("admin", method, route, method === "POST" ? {} : undefined)), route);
  recorder.check("an admin cannot change AI credentials", denied(await status("admin", "POST", "/api/ai/credentials", { providerId: "openai", apiKey: "sk-evil-key-should-never-be-accepted" })));
  recorder.check("a viewer cannot reach AI credentials", denied(await status("viewer", "GET", "/api/ai/credentials")));
  recorder.check("an AI provider health check is owner-only", denied(await status("admin", "POST", "/api/ai/providers/openai/health", {})));

  // ---- Node Agent boundaries ----
  const infra = action => call("admin", "POST", `${root}/infrastructure`, action);
  await infra({ action: "register-repository", repositoryId: "repo-sec", name: "Repository" }); await infra({ action: "onboard-server", serverId: "server-sec", address: "10.0.0.9", credentialReference: "secret-ref:ssh-sec", environment: "test" });
  const enrollment = (await infra({ action: "create-enrollment", nodeId: "node-sec", serverId: "server-sec", expiresAt: new Date(Date.now() + 3_600_000).toISOString() })).body?.result;
  recorder.check("a Node Agent cannot enroll without a valid nonce", (await infra({ action: "register-node", nodeId: "node-sec", enrollmentNonce: "forged-nonce-value", identityFingerprint: "fingerprint-123456" })).status >= 400);
  recorder.check("a secret value is never accepted as a reference", (await infra({ action: "register-secret-metadata", secretId: "secret-sec", reference: "sk-live-abcdefghijklmnop" })).status >= 400);
  recorder.check("a secret reveal needs the owner, fresh MFA and a reason", (await infra({ action: "request-secret-reveal", secretId: "secret-sec", mfaFresh: true, reAuthenticated: true, reason: "evil reveal" })).status >= 400);
  recorder.check("an enrollment record never contains an identity fingerprint secret in the response", !JSON.stringify(enrollment ?? {}).match(/sk-[A-Za-z0-9]{12}/));

  // ---- output hygiene ----
  const sample = JSON.stringify([(await call("viewer", "GET", `${root}/hardening`)).body, (await call("viewer", "GET", `${root}/audit-log`)).body, (await call("viewer", "GET", `${root}/notifications`)).body]);
  recorder.check("read responses never echo a secret-shaped value", !/sk-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._-]{12,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(sample));
  const headers = (await fetch(`${base}/health`)).headers;
  recorder.check("responses carry nosniff", (headers.get("x-content-type-options") ?? "").toLowerCase() === "nosniff", headers.get("x-content-type-options"));
  return recorder.finish();
}
