import {
  HUMAN_ROLES,
  OWNER_ONLY_ACTIONS,
  PROJECT_ACCESS_ACTIONS,
  PROJECT_ROLE_PERMISSIONS
} from "../../contracts/src/project-identity.mjs";

const IDENTIFIER = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function copy(value) {
  return Object.freeze(structuredClone(value));
}

function assertIdentifier(label, value) {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) throw new ProjectAccessError("INVALID_IDENTIFIER", `${label} is invalid.`, 400);
  return value;
}

function normalizeEmail(value) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!EMAIL.test(email) || email.length > 254) throw new ProjectAccessError("INVALID_EMAIL", "email is invalid.", 400);
  return email;
}

function assertOwner(actor) {
  if (!actor || actor.role !== "project-owner") throw new ProjectAccessError("OWNER_REQUIRED", "Only the project owner may manage users or grants.", 403);
  return actor;
}

function assertRole(role) {
  if (!HUMAN_ROLES.includes(role)) throw new ProjectAccessError("INVALID_ROLE", "role is invalid.", 400);
  return role;
}

function grantKey(projectId, userId) {
  return `${projectId}:${userId}`;
}

export class ProjectAccessError extends Error {
  constructor(code, message, statusCode = 403) {
    super(message);
    this.name = "ProjectAccessError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

/** Project-scoped grants are deny-by-default. The owner is deliberately
 * implicit, so an owner account can never lose all access through a bad grant. */
export function createProjectAccessRegistry({ ownerUserId = "hero-owner", ownerUser, now = () => new Date().toISOString(), users = [], grants = [] } = {}) {
  assertIdentifier("ownerUserId", ownerUserId);
  const userById = new Map();
  const userIdByEmail = new Map();
  const grantsByKey = new Map();

  function addUser(input, { allowOwner = false } = {}) {
    const userId = assertIdentifier("userId", input?.userId);
    const email = normalizeEmail(input?.email);
    const role = input?.role ?? "viewer";
    assertRole(role);
    if (role === "project-owner" && (!allowOwner || userId !== ownerUserId)) throw new ProjectAccessError("OWNER_IMMUTABLE", "Only the configured owner may have the owner role.", 403);
    if (userById.has(userId) || userIdByEmail.has(email)) throw new ProjectAccessError("USER_EXISTS", "A user with this identifier or email already exists.", 409);
    const status = input?.status === "disabled" ? "disabled" : "active";
    const user = copy({ userId, email, displayName: String(input?.displayName ?? userId).trim().slice(0, 160), role, status, createdAt: input?.createdAt ?? now() });
    userById.set(userId, user);
    userIdByEmail.set(email, userId);
    return user;
  }

  addUser({ userId: ownerUserId, email: ownerUser?.email ?? "owner@hero.local", displayName: ownerUser?.displayName ?? "Hero Owner", role: "project-owner" }, { allowOwner: true });
  for (const user of users) {
    if (user?.userId === ownerUserId) continue;
    addUser(user);
  }

  function writeGrant(input, { actor, allowHydration = false } = {}) {
    if (!allowHydration) assertOwner(actor);
    const projectId = assertIdentifier("projectId", input?.projectId);
    const userId = assertIdentifier("userId", input?.userId);
    const role = assertRole(input?.role);
    if (role === "project-owner") throw new ProjectAccessError("OWNER_GRANT_FORBIDDEN", "Owner access is not represented by a project grant.", 400);
    if (!userById.has(userId)) throw new ProjectAccessError("USER_NOT_FOUND", "The user does not exist.", 404);
    const key = grantKey(projectId, userId);
    const prior = grantsByKey.get(key);
    const grant = copy({ projectId, userId, role, status: "active", version: (prior?.version ?? 0) + 1, grantedAt: input?.grantedAt ?? now(), grantedBy: actor?.subject ?? ownerUserId });
    grantsByKey.set(key, grant);
    return grant;
  }

  for (const grant of grants) writeGrant(grant, { allowHydration: true, actor: { subject: ownerUserId, role: "project-owner" } });

  function principalRole(principal, projectId) {
    if (!principal || typeof principal.subject !== "string") return null;
    if (principal.role === "project-owner" && principal.subject === ownerUserId) return "project-owner";
    if (userById.get(principal.subject)?.status !== "active") return null;
    const grant = grantsByKey.get(grantKey(projectId, principal.subject));
    return grant?.status === "active" ? grant.role : null;
  }

  function authorize({ principal, projectId, action }) {
    const normalizedProjectId = assertIdentifier("projectId", projectId);
    if (!PROJECT_ACCESS_ACTIONS.includes(action)) throw new ProjectAccessError("ACTION_INVALID", "action is invalid.", 400);
    const role = principalRole(principal, normalizedProjectId);
    if (!role || !PROJECT_ROLE_PERMISSIONS[role].includes(action)) {
      throw new ProjectAccessError("PROJECT_ACCESS_DENIED", "You do not have access to this project action.", 403);
    }
    return copy({ projectId: normalizedProjectId, userId: principal.subject, role, action, cacheKey: `hero:project:${normalizedProjectId}` });
  }

  return Object.freeze({
    createUser({ actor, user }) {
      assertOwner(actor);
      return addUser(user);
    },
    hydrateUser({ user }) {
      if (!user || user.userId === ownerUserId || userById.has(user.userId)) return userById.get(user?.userId) ? copy(userById.get(user.userId)) : null;
      return addUser(user);
    },
    findUserByEmail(email) {
      const userId = userIdByEmail.get(normalizeEmail(email));
      return userId ? copy(userById.get(userId)) : null;
    },
    getUser(userId) {
      return userById.has(userId) ? copy(userById.get(userId)) : null;
    },
    listUsers({ actor }) {
      assertOwner(actor);
      return Object.freeze([...userById.values()].map(copy));
    },
    upsertGrant({ actor, grant }) {
      return writeGrant(grant, { actor });
    },
    hydrateGrant({ grant }) {
      const projectId = assertIdentifier("projectId", grant?.projectId);
      const userId = assertIdentifier("userId", grant?.userId);
      const role = assertRole(grant?.role);
      if (role === "project-owner" || !userById.has(userId)) throw new ProjectAccessError("GRANT_INVALID", "A hydrated grant is invalid.", 400);
      grantsByKey.set(grantKey(projectId, userId), copy({ projectId, userId, role, status: grant.status === "revoked" ? "revoked" : "active", version: Number(grant.version) || 1, grantedAt: grant.grantedAt ?? now(), grantedBy: grant.grantedBy ?? ownerUserId, revokedAt: grant.revokedAt ?? null, revokedBy: grant.revokedBy ?? null }));
      return copy(grantsByKey.get(grantKey(projectId, userId)));
    },
    revokeGrant({ actor, projectId, userId }) {
      assertOwner(actor);
      const key = grantKey(assertIdentifier("projectId", projectId), assertIdentifier("userId", userId));
      const prior = grantsByKey.get(key);
      if (!prior) throw new ProjectAccessError("GRANT_NOT_FOUND", "The project grant does not exist.", 404);
      const revoked = copy({ ...prior, status: "revoked", version: prior.version + 1, revokedAt: now(), revokedBy: actor.subject });
      grantsByKey.set(key, revoked);
      return revoked;
    },
    listProjectGrants({ principal, projectId }) {
      authorize({ principal, projectId, action: "project.grant.read" });
      return Object.freeze([...grantsByKey.values()].filter(grant => grant.projectId === projectId).map(copy));
    },
    listAccessibleProjectIds({ principal }) {
      if (!principal || typeof principal.subject !== "string") return Object.freeze([]);
      if (principal.role === "project-owner" && principal.subject === ownerUserId) return null;
      return Object.freeze([...grantsByKey.values()]
        .filter(grant => grant.userId === principal.subject && grant.status === "active")
        .map(grant => grant.projectId)
        .sort());
    },
    authorize,
    principalRole,
    scopedResourceKey({ projectId, resource, identifier = null }) {
      const normalizedProjectId = assertIdentifier("projectId", projectId);
      if (typeof resource !== "string" || !/^[a-z][a-z0-9-]{1,63}$/.test(resource)) throw new ProjectAccessError("RESOURCE_INVALID", "resource is invalid.", 400);
      if (identifier !== null) assertIdentifier("identifier", identifier);
      return identifier ? `hero:${resource}:${normalizedProjectId}:${identifier}` : `hero:${resource}:${normalizedProjectId}`;
    },
    ownerUserId,
    ownerOnlyActions: OWNER_ONLY_ACTIONS
  });
}
