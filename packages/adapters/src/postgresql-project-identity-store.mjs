const IDENTIFIER = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;
const SECRET_FIELD = /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|credential|authorization)/i;

function copy(value) {
  return Object.freeze(structuredClone(value));
}

function assertTarget({ client, pool }) {
  if (client && typeof client.query === "function") return;
  if (pool && typeof pool.query === "function" && typeof pool.connect === "function") return;
  throw new Error("Project identity store requires an injected PostgreSQL client or pool.");
}

function assertIdentifier(label, value) {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) throw new ProjectIdentityStoreError("INVALID_IDENTIFIER", `${label} is invalid.`);
  return value;
}

function assertSafeAudit(value, path = "data") {
  if (Array.isArray(value)) return value.forEach((item, index) => assertSafeAudit(item, `${path}[${index}]`));
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (SECRET_FIELD.test(key)) throw new ProjectIdentityStoreError("SENSITIVE_AUDIT_DATA", `${path}.${key} is not allowed in identity audit data.`);
    assertSafeAudit(child, `${path}.${key}`);
  }
}

function rowToGrant(row) {
  return copy({ projectId: row.project_id, userId: row.user_id, role: row.role, status: row.status, version: Number(row.grant_version), grantedBy: row.granted_by, recordedAt: row.recorded_at instanceof Date ? row.recorded_at.toISOString() : row.recorded_at });
}

export class ProjectIdentityStoreError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ProjectIdentityStoreError";
    this.code = code;
  }
}

export function createPostgresProjectIdentityStore({ client, pool } = {}) {
  assertTarget({ client, pool });
  const target = client ?? pool;

  return Object.freeze({
    async saveUser({ userId, email, displayName, passwordHash, passwordSalt, mfaSecretRef = null, mfaRequired = false, status = "active" }) {
      assertIdentifier("userId", userId);
      if (typeof email !== "string" || email.length < 3 || typeof passwordHash !== "string" || typeof passwordSalt !== "string" || !["active", "disabled"].includes(status)) throw new ProjectIdentityStoreError("INVALID_USER", "User persistence fields are invalid.");
      const result = await target.query(
        `INSERT INTO human_users (user_id, email, display_name, status, password_hash, password_salt, mfa_secret_ref, mfa_required)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (user_id) DO UPDATE SET
           email = EXCLUDED.email,
           display_name = EXCLUDED.display_name,
           status = EXCLUDED.status,
           password_hash = EXCLUDED.password_hash,
           password_salt = EXCLUDED.password_salt,
           mfa_secret_ref = EXCLUDED.mfa_secret_ref,
           mfa_required = EXCLUDED.mfa_required,
           updated_at = now()
         RETURNING user_id, email, display_name, status, mfa_required, created_at`,
        [userId, email.toLowerCase(), String(displayName ?? userId).slice(0, 160), status, passwordHash, passwordSalt, mfaSecretRef, Boolean(mfaRequired)]
      );
      return result.rows?.[0] ? copy({ userId: result.rows[0].user_id, email: result.rows[0].email, displayName: result.rows[0].display_name, status: result.rows[0].status, mfaRequired: result.rows[0].mfa_required }) : null;
    },

    async listUsers() {
      const result = await target.query(
        `SELECT user_id, email, display_name, status, password_hash, password_salt, mfa_secret_ref, mfa_required, created_at
           FROM human_users
          WHERE status IN ('active', 'disabled')
          ORDER BY user_id`
      );
      return Object.freeze((result.rows ?? []).map(row => copy({
        userId: row.user_id,
        email: row.email,
        displayName: row.display_name,
        status: row.status,
        passwordHash: row.password_hash,
        passwordSalt: row.password_salt,
        mfaSecretRef: row.mfa_secret_ref,
        mfaRequired: Boolean(row.mfa_required),
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at
      })));
    },

    async appendGrant({ projectId, userId, role, status = "active", grantedBy }) {
      assertIdentifier("projectId", projectId);
      assertIdentifier("userId", userId);
      assertIdentifier("grantedBy", grantedBy);
      if (!["admin", "viewer"].includes(role) || !["active", "revoked"].includes(status)) throw new ProjectIdentityStoreError("INVALID_GRANT", "Grant role or status is invalid.");
      await target.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`grant:${projectId}:${userId}`]);
      const current = await target.query(
        "SELECT COALESCE(MAX(grant_version), 0) AS version FROM project_grant_versions WHERE project_id = $1 AND user_id = $2",
        [projectId, userId]
      );
      const version = Number(current.rows?.[0]?.version ?? 0) + 1;
      const inserted = await target.query(
        `INSERT INTO project_grant_versions (project_id, user_id, grant_version, role, status, granted_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING project_id, user_id, grant_version, role, status, granted_by, recorded_at`,
        [projectId, userId, version, role, status, grantedBy]
      );
      return rowToGrant(inserted.rows?.[0]);
    },

    async listCurrentGrants({ projectId, userId } = {}) {
      if (projectId !== undefined) assertIdentifier("projectId", projectId);
      if (userId !== undefined) assertIdentifier("userId", userId);
      const result = await target.query(
        `SELECT DISTINCT ON (project_id, user_id)
                project_id, user_id, grant_version, role, status, granted_by, recorded_at
           FROM project_grant_versions
          WHERE ($1::text IS NULL OR project_id = $1)
            AND ($2::text IS NULL OR user_id = $2)
          ORDER BY project_id, user_id, grant_version DESC`,
        [projectId ?? null, userId ?? null]
      );
      return Object.freeze((result.rows ?? []).map(rowToGrant));
    },

    async listSessionRevocations() {
      const result = await target.query(
        `SELECT session_id, user_id, reason, revoked_at
           FROM human_session_revocations
          ORDER BY revoked_at ASC`
      );
      return Object.freeze((result.rows ?? []).map(row => copy({
        sessionId: row.session_id,
        userId: row.user_id,
        reason: row.reason,
        revokedAt: row.revoked_at instanceof Date ? row.revoked_at.toISOString() : row.revoked_at
      })));
    },

    async revokeSession({ sessionId, userId, reason = "user-request" }) {
      assertIdentifier("sessionId", sessionId);
      assertIdentifier("userId", userId);
      if (typeof reason !== "string" || reason.trim() === "") throw new ProjectIdentityStoreError("INVALID_SESSION", "Session revocation reason is invalid.");
      await target.query(
        `INSERT INTO human_session_revocations (session_id, user_id, reason)
         VALUES ($1, $2, $3)
         ON CONFLICT (session_id) DO NOTHING`,
        [sessionId, userId, reason.trim().slice(0, 240)]
      );
      return copy({ sessionId, userId, reason: reason.trim().slice(0, 240) });
    },

    async recordAudit({ auditId, userId = null, eventType, outcome, data = {} }) {
      assertIdentifier("auditId", auditId);
      if (userId !== null) assertIdentifier("userId", userId);
      if (typeof eventType !== "string" || typeof outcome !== "string") throw new ProjectIdentityStoreError("INVALID_AUDIT", "Identity audit event is invalid.");
      assertSafeAudit(data);
      await target.query(
        `INSERT INTO human_identity_audit (audit_id, user_id, event_type, outcome, data)
         VALUES ($1, $2, $3, $4, $5)`,
        [auditId, userId, eventType, outcome, data]
      );
      return copy({ auditId, userId, eventType, outcome });
    }
  });
}
