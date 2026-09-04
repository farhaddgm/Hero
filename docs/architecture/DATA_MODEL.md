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
| Planning / output advisory | `planning_records` | Versioned product Spec, valid Task Graph, explained routing, multi-option output comparison and owner decision |
| Team / review / training / assignment | `teams`, `team_reviews`, `team_training`, `team_assignments` | Versioned charter, owner decisions, readiness and project role |
| Team research | `team_research` | Research request, benchmark report, evidence, owner decision and applied knowledge/principles |
| Team workflow policy | `team_workflows` | Per-project stage owners and approval mode |
| Critical principle / review | `principles`, `principle_reviews` | Hero baseline and product-specific blocking rules with owner decisions |
| Release / environment evidence | `releases`, `release_evidence` | Exact Artifact/version/commit promotion from test to production |
| AI Provider / Model / Profile / Binding | `ai_providers`, `ai_models`, `agent_profiles`, `project_agent_bindings` | Replaceable Provider/Model selection without changing Team ownership or prior history |
| AI Invocation / Evaluation / Decision | `ai_invocations`, `evaluations`, `decision_proposals` | Profile and Context snapshots, structured evidence and owner-resolved proposals |
| Organization performance / team metrics | `organization_performance_reviews`, `organization_performance_metrics` | Exactly 11-team, period-bound evidence and advisory findings |
| AI benchmark run / result | `ai_benchmark_runs`, `ai_benchmark_results` | Synthetic, versioned Provider/Profile comparison without authority |
| Outbox | `outbox` | Durable dispatch created with the source event transaction |
| Control command audit | `events` (`control.command-recorded`) | Safe, paginatable owner timeline; raw command input and secrets are excluded |
| Domain Registry restart projection | `domain_registry_snapshots` | Append-only versioned snapshots for startup hydration; never a replacement for Events |

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

HERO-015 adds `planning_records` for a versioned Persian request Spec, its explicit assumptions and acceptance criteria, a validated acyclic Task Graph and the reason behind each route. The output advisory compares product forms across value, speed, cost, risk, maintainability, scalability and user fit; the owner decision is a separate versioned event. Planning remains read-only: it records no live provider output and never creates a Runner. A graph can be halted before dispatch, and its later execution still requires the version-bound authorization, approved output decision and runner boundaries.

## Team projection

The team aggregate stores the phase-one catalog definition, contract approvals, default principles, versioned knowledge, training modules, stage-specific autonomy, project assignments, deliverable reviews and rework history. A team becomes `ready` only after all seven contract sections are approved by `project-owner` and all five training modules have a passing score. Team input and output reviews retain Project ID, Artifact ID, direction and artifact version. Merge and split operations retire the old aggregate instead of deleting it, so the audit trail remains complete.

The `team_research` record stores a research request, benchmark brief, evidence-rich report and owner decision. A report may propose knowledge, principles and training updates, but only an approved review applies those values to the team projection.

The current `TeamRegistry` is a deterministic in-process projection for commands and tests. PostgreSQL stores its versioned restart snapshot and new Registry events through the operational adapter; owner-gated commands, idempotency, optimistic concurrency, append-only events and the rule that team autonomy never grants sensitive operations remain unchanged.

## Critical principles projection

`principles` stores the inherited Hero baseline and product-specific rules. Each record has a scope, control points, enforcement, status, version, owner decision and feedback. A read-only evaluation returns `ready` or a list of blocking principles; no task, team assignment or release may silently ignore a blocking result.

## Release projection

`releases` stores `project_id`, `artifact_id`, SemVer, commit SHA, state, test environment status, production environment status and the linked Evidence. The production transition is valid only when the exact tested Artifact/version/commit matches, all release principles pass, test Evidence is successful, owner approval exists, a separate production authorization reference exists and the owner has issued the explicit promotion command.

## Current implementation boundary

`packages/contracts` owns the stable event schema. `packages/domain` provides an in-memory append-only log with duplicate protection and optimistic concurrency for deterministic tests; `packages/adapters` provides the PostgreSQL equivalent plus versioned Domain Registry snapshots for restart hydration.

The Multi-AI foundation adds deterministic projections for Provider, Model, Agent Profile, Project Role Binding, Invocation, Evaluation and Decision Proposal. When Project Memory is injected, every Invocation can consume only a role-mapped, read-only Context Snapshot with exact Task/Step/document-version matching; stale or missing context blocks the invocation. These records are subordinate to the existing Project, Task, Run, Memory, Authorization and Quality boundaries. An Evaluation is Evidence, and resolving a Decision Proposal never creates an Authorization implicitly. Credential fields are runtime references only; raw credential values are rejected before they can enter Domain or Event data. Organization performance and synthetic benchmark projections are additive evidence stores, not command authorities; their event source remains Hero's append-only Event Store.

The PostgreSQL boundary is checked in at `packages/adapters/migrations/001_principles_release_audit.sql` through `006_read_model_access_audit.sql`. Its injected migration runner is `packages/adapters/src/postgresql-schema.mjs`, and `packages/adapters/src/postgresql-operational-store.mjs` provides the transaction-bound append/read Event Store with advisory aggregate locking, optional Outbox insertion and bounded claim/ack/fail delivery state. `postgresql-runtime.mjs` can create a bounded `pg` pool from the runtime-only `HERO_POSTGRES_URL`, apply migrations and expose ping/readiness; `postgresql-command-audit.mjs` records accepted Control Plane commands as safe `control.command-recorded` events, while `domain-registry-snapshot-store.mjs` saves and loads append-only Registry snapshots, `owner-session-store.mjs` restores append-only session revocations, `postgresql-benchmark-store.mjs` persists only synthetic, digest-validated, authority-free benchmark evidence with idempotency and advisory comparison, and `postgresql-read-model-access-audit.mjs` stores only route metadata for accepted/rejected GET reads. At startup the Control Plane hydrates its Domain projections, benchmark history and revoked owner sessions from PostgreSQL; after a successful command, new Domain Events are persisted before the audit/Snapshot step. Production deployment, external spend and live Provider access remain separately authorized work.
