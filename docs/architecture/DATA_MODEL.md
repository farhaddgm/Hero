# Hero operational data model

## Source of truth

PostgreSQL is the future operational source of truth. The event log is append-only; read models exist for speed and do not replace the immutable record.

| Entity | PostgreSQL table | Important boundary |
| --- | --- | --- |
| Project / Work item / Task | `projects`, `work_items`, `tasks` | One project boundary per customer request |
| Authorization | `authorizations` | Binds Step ID, document version and permitted operations |
| Run | `runs` | One isolated worktree/container execution |
| Event | `events` | Unique `event_id`, global sequence and aggregate version |
| Evidence / Artifact | `evidence`, `artifacts` | References and summaries only; no secrets in payloads |
| Outbox | `outbox` | Durable dispatch created with the source event transaction |

## Transaction rule

For a command that changes state, the PostgreSQL adapter will: lock or compare the Aggregate version, append a new Event, update the permitted read model, insert any Outbox command, then commit once. The Runner may only act after that commit.

## Event safety

An event carries a fixed identifier, timestamp, actor, correlation/causation links, typed Aggregate and versioned data. A secret-shaped field name or value is rejected before it reaches the log. Redaction is not a substitute for validation: secrets must never be accepted.

## Run lifecycle projection

HERO-006 projects each Run as an explicit State Machine: `draft`, `planned`, `queued`, `running`, `awaiting-review`, `paused`, `failed`, `completed` or `cancelled`. A transition appends a typed `run.*` Event, uses aggregate-version optimistic concurrency and requires an idempotency key. `paused` retains a safe `resumeState`; `failed` retries only through `queued`; completed and cancelled Runs are terminal.

## Current implementation boundary

`packages/contracts` owns the stable event schema. `packages/domain` provides an in-memory append-only log with duplicate protection and optimistic concurrency for deterministic tests. A future PostgreSQL adapter must preserve these semantics.
