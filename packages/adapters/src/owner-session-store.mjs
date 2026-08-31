const IDENTIFIER = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;

function copy(value) {
  return Object.freeze(structuredClone(value));
}

function assertIdentifier(label, value) {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) throw new Error(`${label} is invalid.`);
  return value;
}

function assertTarget({ client, pool }) {
  if (client && typeof client.query === "function") return;
  if (pool && typeof pool.query === "function") return;
  throw new Error("Owner session store requires a PostgreSQL client or pool.");
}

function rowToRecord(row) {
  return copy({
    sessionId: row.session_id,
    subject: row.subject,
    revokedAt: row.revoked_at instanceof Date ? row.revoked_at.toISOString() : row.revoked_at,
    reason: row.reason
  });
}

export function createPostgresOwnerSessionStore({ client, pool } = {}) {
  assertTarget({ client, pool });
  const target = client ?? pool;

  return Object.freeze({
    async revoke({ sessionId, subject, reason = "owner-request", revokedAt } = {}) {
      assertIdentifier("sessionId", sessionId);
      assertIdentifier("subject", subject);
      if (typeof reason !== "string" || reason.trim() === "") throw new Error("reason is invalid.");
      const result = await target.query(
        `INSERT INTO owner_session_revocations (session_id, subject, revoked_at, reason)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (session_id) DO NOTHING
         RETURNING session_id, subject, revoked_at, reason`,
        [sessionId, subject, revokedAt ?? new Date().toISOString(), reason.trim().slice(0, 240)]
      );
      if (result.rows?.[0]) return rowToRecord(result.rows[0]);
      const existing = await target.query(
        "SELECT session_id, subject, revoked_at, reason FROM owner_session_revocations WHERE session_id = $1",
        [sessionId]
      );
      return rowToRecord(existing.rows?.[0]);
    },

    async list() {
      const result = await target.query(
        "SELECT session_id, subject, revoked_at, reason FROM owner_session_revocations ORDER BY revoked_at ASC, session_id ASC"
      );
      return Object.freeze((result.rows ?? []).map(rowToRecord));
    }
  });
}
