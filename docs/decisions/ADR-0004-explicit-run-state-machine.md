# ADR-0004 — explicit Run State Machine over append-only events

## Context

Hero will pause, resume, retry, review and cancel long-running development work. Boolean flags or free-form statuses make illegal combinations and duplicate dispatches likely, especially when the UI, a retrying client and future Runner act concurrently.

## Decision

Use a small explicit State Machine in the Domain layer. Every state transition requires an idempotency key, validates an optional expected version, appends a typed `run.*` Event and produces an immutable Run projection. A repeated equivalent command returns its original result without appending a new Event; a changed payload under the same key fails.

`paused` stores a `resumeState`; `failed` may retry only to `queued`; `completed` and `cancelled` are terminal. Review is explicit rather than a hidden flag.

## Consequences

- Lifecycle behavior can be tested without real agents or infrastructure.
- Future PostgreSQL persistence must preserve the same idempotency and optimistic-concurrency semantics in one transaction with its Outbox record.
- The engine intentionally cannot start or stop a host process. HERO-008 must connect these domain checkpoints to an isolated Runner.
- Retry limits, spend limits and authorization decisions remain separate policy concerns; the State Machine provides the safe primitive, not blanket permission.
