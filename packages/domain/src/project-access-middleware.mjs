import { ProjectAccessError } from "./project-access.mjs";

const PROJECT_ID = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;

/** Common command/query authorization boundary. API handlers pass a project id
 * explicitly; cache, queue, storage and event keys originate from this scope. */
export function createProjectAccessMiddleware({ accessRegistry, identity } = {}) {
  if (!accessRegistry || typeof accessRegistry.authorize !== "function" || typeof accessRegistry.scopedResourceKey !== "function") {
    throw new Error("Project access middleware requires a ProjectAccess registry.");
  }
  if (!identity || typeof identity.authenticate !== "function") throw new Error("Project access middleware requires human identity authentication.");

  function authenticate(authorizationHeader) {
    const principal = identity.authenticate(authorizationHeader);
    return Object.freeze({ ...principal, actor: Object.freeze({ kind: principal.role === "project-owner" ? "project-owner" : "admin", id: principal.subject }) });
  }

  function requireProject({ principal, projectId, action, sensitive = false }) {
    if (typeof projectId !== "string" || !PROJECT_ID.test(projectId)) throw new ProjectAccessError("PROJECT_ID_REQUIRED", "A valid projectId is required.", 400);
    const decision = accessRegistry.authorize({ principal, projectId, action });
    if (sensitive) identity.assertSensitiveActionAllowed({ principal, action });
    return Object.freeze({
      ...decision,
      storageKey: accessRegistry.scopedResourceKey({ projectId, resource: "storage" }),
      cacheKey: accessRegistry.scopedResourceKey({ projectId, resource: "cache" }),
      queueKey: accessRegistry.scopedResourceKey({ projectId, resource: "queue" }),
      eventKey: accessRegistry.scopedResourceKey({ projectId, resource: "event" })
    });
  }

  return Object.freeze({ authenticate, requireProject });
}
