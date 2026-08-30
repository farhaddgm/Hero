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
| Project memory | `memory_records` | Append-only versions; role-filtered, minimum Context only |
| Planning | `planning_records` | Versioned product Spec, valid Task Graph and explained routing |
| Team / review / training / assignment | `teams`, `team_reviews`, `team_training`, `team_assignments` | Versioned charter, owner decisions, readiness and project role |
| Team workflow policy | `team_workflows` | Per-project stage owners and approval mode |
| Critical principle / review | `principles`, `principle_reviews` | Hero baseline and product-specific blocking rules with owner decisions |
| Release / environment evidence | `releases`, `release_evidence` | Exact Artifact/version/commit promotion from test to production |
| Outbox | `outbox` | Durable dispatch created with the source event transaction |
| Control command audit | `events` (`control.command-recorded`) | Safe, paginatable owner timeline; raw command input and secrets are excluded |

## Transaction rule

For a command that changes state, the PostgreSQL adapter will: lock or compare the Aggregate version, append a new Event, update the permitted read model, insert any Outbox command, then commit once. The Runner may only act after that commit.

## Event safety

An event carries a fixed identifier, timestamp, actor, correlation/causation links, typed Aggregate and versioned data. A secret-shaped field name or value is rejected before it reaches the log. Redaction is not a substitute for validation: secrets must never be accepted.

## Run lifecycle projection

HERO-006 projects each Run as an explicit State Machine: `draft`, `planned`, `queued`, `running`, `awaiting-review`, `paused`, `failed`, `completed` or `cancelled`. A transition appends a typed `run.*` Event, uses aggregate-version optimistic concurrency and requires an idempotency key. `paused` retains a safe `resumeState`; `failed` retries only through `queued`; completed and cancelled Runs are terminal.

## Authorization projection

HERO-007 projects a direct or batch Snapshot authorization as an immutable set of `(stepId, documentVersion)` entries, explicit development operations, active/revoked status and an Event-backed audit trail. Dispatch checks use a separate decision aggregate so auditing an allow/deny result does not mutate a grant. Global Stop has its own append-only authorization aggregate and blocks every new dispatch.

## Runner projection

HERO-008 adds a `runner` aggregate. Its immutable projection binds one Runner ID to one Run, Task, Step/version, authorization grant ID, relative Worktree key, task branch, read-only base ref, timeout and checkpoint. `runner.prepared`, `runner.started`, checkpoint, failure, cancellation and cleanup events are append-only. The projection is not a host path and does not store a command, provider credential or secret.

## Project memory projection

HERO-014 adds `memory_records` as a versioned, append-only projection for approved rules, architecture, decisions, evidence and internal artifacts. A Context packet selects only the latest eligible record per key, filters it by recipient role and enforces an exact Task, Step and document version for task-scoped memory. A stale task record blocks assembly rather than being silently reused. Packets are read-only internal artifacts and reject secrets, external references and host paths.

## Planning projection

HERO-015 adds `planning_records` for a versioned Persian request Spec, its explicit assumptions and acceptance criteria, a validated acyclic Task Graph and the reason behind each route. Planning remains read-only: it records no live provider output and never creates a Runner. A graph can be halted before dispatch, and its later execution still requires the version-bound authorization and runner boundaries.

## Team projection

The team aggregate stores the phase-one catalog definition, contract approvals, training modules, stage-specific autonomy, project assignments, deliverable reviews and rework history. A team becomes `ready` only after all seven contract sections are approved by `project-owner` and all five training modules have a passing score. Team input and output reviews retain Project ID, Artifact ID, direction and artifact version. Merge and split operations retire the old aggregate instead of deleting it, so the audit trail remains complete.

The current `TeamRegistry` is an in-memory projection for deterministic tests and the control API. A future PostgreSQL adapter must preserve owner-gated commands, idempotency, optimistic concurrency, append-only events and the rule that team autonomy never grants sensitive operations.

## Critical principles projection

`principles` stores the inherited Hero baseline and product-specific rules. Each record has a scope, control points, enforcement, status, version, owner decision and feedback. A read-only evaluation returns `ready` or a list of blocking principles; no task, team assignment or release may silently ignore a blocking result.

## Release projection

`releases` stores `project_id`, `artifact_id`, SemVer, commit SHA, state, test environment status, production environment status and the linked Evidence. The production transition is valid only when the exact tested Artifact/version/commit matches, all release principles pass, test Evidence is successful, owner approval exists, a separate production authorization reference exists and the owner has issued the explicit promotion command.

## Current implementation boundary

`packages/contracts` owns the stable event schema. `packages/domain` provides an in-memory append-only log with duplicate protection and optimistic concurrency for deterministic tests. A future PostgreSQL adapter must preserve these semantics.

The first PostgreSQL boundary is checked in at `packages/adapters/migrations/001_principles_release_audit.sql`. Its injected migration runner is `packages/adapters/src/postgresql-schema.mjs`, and `packages/adapters/src/postgresql-operational-store.mjs` provides the transaction-bound append/read Event Store with advisory aggregate locking and optional Outbox insertion. `postgresql-runtime.mjs` can create a bounded `pg` pool from the runtime-only `HERO_POSTGRES_URL`, apply the migration and expose a ping/readiness result; the Control Plane uses this path only when that URL is configured. `postgresql-command-audit.mjs` records accepted Control Plane commands as safe `control.command-recorded` events, and the authenticated audit endpoint reads them by global sequence. Domain command projections remain deterministic in-memory until their async persistence port is separately integrated. Durable owner-session revocation and production deployment remain separately authorized work.
