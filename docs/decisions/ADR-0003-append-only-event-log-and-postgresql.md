# ADR-0003 — Append-only Event Log and PostgreSQL Outbox

- Status: Accepted
- Date: 2026-08-14
- Roadmap step: HERO-005

## Context

Hero coordinates user decisions, version-bound authorization, isolated execution, tests and delivery. A mutable status row alone cannot explain who changed what, recover a failed Run, or prove the authorization in effect at dispatch time.

## Decision

Use a versioned, append-only Event Log as the truth for operational changes. Use PostgreSQL as the future persistence and transaction boundary. A command will append the Event and its Outbox dispatch in the same database transaction. Enforce unique Event IDs, per-Aggregate optimistic concurrency and a no-secret Event payload rule.

Use a deterministic in-memory Domain implementation now. It defines the behavior a PostgreSQL adapter must preserve without introducing a database server or queue prematurely.

## Consequences

- State changes are explainable, auditable and recoverable through ordered events.
- A duplicate or concurrent command fails closed instead of silently overwriting state.
- A standalone message queue is deferred; the Outbox provides durable dispatch once PostgreSQL is connected.
- Event data must contain references and safe summaries, never credentials or raw Secret values.
