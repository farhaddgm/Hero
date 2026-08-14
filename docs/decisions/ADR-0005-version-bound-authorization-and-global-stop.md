# ADR-0005 — version-bound authorization and Global Stop

## Context

Hero must let a non-developer owner approve one item at a time or grant temporary autonomy to an existing set of roadmap items. A simple boolean such as `approved=true` would permit stale specifications, newly inserted work and sensitive actions to slip through.

## Decision

Use explicit direct and batch-snapshot grants. Each entry binds a Step ID to an approved document version and a finite set of development operations. The engine authorizes a dispatch only when all identity, version, status and operation checks match exactly. Unknown or missing data denies the dispatch.

Only the project-owner may grant, revoke, activate Global Stop or clear it. Grant, revocation, Global Stop changes and dispatch decisions are append-only operational events. Global Stop blocks new work and marks active work for safe-checkpoint pause; it does not kill a process in the Domain layer.

## Consequences

- Full autonomy is bounded to the snapshot that existed at grant time.
- A revised spec requires a new entry; no stale approval follows it automatically.
- Production, destructive data operations, external spend, secret changes, external messages and irreversible actions remain independent gates.
- Runner-level cancellation and durable PostgreSQL persistence must preserve these decision semantics in later steps.
