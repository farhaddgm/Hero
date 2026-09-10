# Hero architecture overview

مدل canonical محیط‌های Hero و Product در [ENVIRONMENT-AND-PRODUCT-RELEASE-MODEL.md](ENVIRONMENT-AND-PRODUCT-RELEASE-MODEL.md) و فهرست همهٔ اسناد ثبت‌شده در [فهرست مرکزی](../INDEX.md) قرار دارد. این overview خلاصه است و جای آن مراجع را نمی‌گیرد.

## Chosen shape

Hero is a modular monolith with isolated execution runners. The Control Plane owns coordination and policy; no UI or Provider adapter is allowed to bypass that policy.

```text
Persian Console
      |
      v
Control Plane (HTTP API + Team/Principles/Release Control)
      |
Application use cases
      |
Domain policy + Team Contracts + Ports
      |------------------------|
      v                        v
PostgreSQL adapters      Provider / Git / Runner adapters
                                  |
                                  v
                    Isolated worktree or container Run
                                  |
                    v
                    Evidence + independent review
```

The Team Control boundary treats each phase-one operating-model team as a governed unit with a versioned charter, decision rights, inputs, outputs, default principles, knowledge, training status, project assignments and stage-specific autonomy. The owner can review or reject each contract section, request rework, review project input/output artifacts, commission evidence-based research, approve applied team learning, change workflow policy, and preserve history across team merge/split operations. The registries run deterministically in-process and use PostgreSQL versioned snapshots for restart hydration; the append-only event log remains the source of truth and live execution remains a separate boundary.

The Critical Principles boundary makes the non-negotiable rules executable. Hero's baseline principles are inherited by every product; product-specific principles are added as versioned, owner-reviewed records. A missing or rejected principle blocks the relevant control point. The Release Promotion boundary keeps test and production separate, binds both to one Artifact/version/commit, and requires test evidence, owner approval, an explicit production command and separate `production-deploy` authorization.

The system is intentionally not a microservice fleet. Ports form the extraction boundary: an adapter may be replaced without changing the user flow or domain policy.

## Dependency rule

`experience -> application -> domain/ports <- adapters/execution`

Domain has no dependency on Provider CLIs, HTTP frameworks, database drivers or host paths. Execution never receives an authorization merely because a UI requested it; the Application layer validates the versioned snapshot first.

## Data, dispatch and lifecycle

HERO-005 defines PostgreSQL as the target source of truth for operational records, append-only events, authorization snapshots and durable outbox dispatch. The runtime applies migrations, records accepted Control Plane commands as safe audit events, writes append-only Domain Registry snapshots and hydrates them at startup. HERO-006 adds the deterministic Run State Machine above that Event Log. HERO-007 adds the fail-closed authorization decision boundary and Global Stop. HERO-008 adds the isolated Runner boundary: a version-matched dispatch allocates a relative Worktree identity with closed-network defaults, checkpoint-before-cleanup and bounded concurrency. No independent queue is selected before its operational need is proven.

HERO-014 adds shared project memory above the dispatch boundary. It is not a raw chat transcript: each record is versioned, role-filtered and bounded to the current Project or exact Task/Step/document version. Context assembly is read-only and fail-closed for stale task memory, so an Agent cannot silently receive an obsolete design or unrelated project history.

HERO-015 adds the Planner and Router before dispatch. It converts a simple Persian request into an explicit product Spec, assumptions, acceptance criteria and a validated Task Graph. The Router makes every choice explainable: ChatGPT analyzes and designs, Codex implements and tests, Claude reviews independently, and Cursor receives only a human-controlled handoff. It does not connect to any provider in this stage.

The team research and output advisory layer sits between planning and dispatch. It gives each team a benchmark brief, requires an evidence-rich report before owner review, and compares multiple product output forms. An approved output choice and ready owner teams are both required before any future dispatch.

HERO-016 adds the bounded Quality Gate after implementation: isolated Codex test evidence is recorded, deterministic Claude review is evaluated, and a finding can unlock only a separately authorized correction followed by retest. The gate records accounted cost units, caps correction cycles, and ends in `approved` or a safe `stopped` state. It is a policy and evidence boundary, not a hidden live-provider loop.

HERO-017 adds the Web Factory. A ready planning record and exact `develop` authorization produce a version-bound Blueprint and Feature Recipe for a Persian web application: Next.js/React/TypeScript, REST route handlers, a PostgreSQL adapter boundary, a separately configured authentication boundary, isolated Quality Gate evidence, and a Cursor handoff reference. It does not install a framework, invoke a provider, provision a database, configure authentication or publish a preview. Preview is visibly prepared but cannot dispatch without its own authorization; the active Snapshot for this step covers development and testing only.

HERO-018 adds the Mobile Factory alongside the Web Factory, with a separate native UI contract instead of reusing web UI. A ready plan and exact `develop` authorization create an Expo/React Native/TypeScript Blueprint and Recipe for Android and iOS, reusing only the versioned API and data boundaries. It records Android Preview as a separate Preview gate and iOS EAS/cloud build as a separately authorized external-spend gate. Neither Expo installation, mobile build, Preview nor cloud call happens in this step.

HERO-019 adds the Assurance Gate after Quality Gate and before any future delivery or release adapter. It records only local CI evidence, secret-safe closed-network security evidence, local append-only observability coverage and bounded cost units. Its output is `ASSURANCE_APPROVED` or a safe block. It neither dispatches CI nor exports telemetry; release, deploy and any external spend remain separate authorizations.

HERO-020 adds a deterministic Portability Gate for a future server move. It requires evidence for the independent source boundary, the Linux/Compose contract, a project-scoped secret-free backup checksum, a matching restore checksum and a clean Linux verification. It emits `PORTABILITY_VERIFIED` only as a readiness record; repository copying, backup operations, secret access, host provisioning, container start and production operation remain separately authorized.

The Critical Principles and Release Flow contracts add the missing product-wide rule layer. `CriticalPrinciplesRegistry` governs Hero and product rules with owner review, rework and blocking checks. `ReleasePromotion` governs the exact path `Git commit/tag -> test deployment -> test evidence -> owner approval -> explicit production command -> production deployment evidence`; the current implementation records the gate deterministically but leaves the live Deployment Adapter disabled.

## Provider boundary

Codex/ChatGPT performs primary implementation, Claude performs independent review, and Cursor receives an IDE handoff. All three are provider adapters with no live credential or CLI connection in this step.

The Multi-AI orchestration subsystem generalizes this boundary without changing the current authority model. `Team`, AI `Role`, `Agent Profile`, `Provider`, `Model` and Credential Reference are separate concepts. A Profile can select a Provider/Model for a Role and is snapshotted on every AI Invocation. The Invocation Context Assembly consumes only a role-mapped, exact-version Project Memory packet. Evaluation is recorded as Evidence and a Decision Proposal never becomes Authorization automatically. Planner now records the AI Role/schema/policy for each task, Quality Gate can consume linked evaluator evidence through an async revision loop, and an organization review can compare all 11 teams without mutating them. OpenAI Responses, Anthropic Messages, Google Gemini and OpenAI-compatible adapters are available behind runtime credentials and cost accounting; an active version-bound external-spend authorization verifier is still required before any live call. Owner-authenticated deterministic commands are exposed through the Control Plane. The deterministic foundation, adapters and hydration phases are documented in [AI_ORCHESTRATION.md](AI_ORCHESTRATION.md) and ADR-0009.

## Product-factory boundary

The orchestrator's own console is web-first. The apps it produces have two target presets: Next.js/React for web and Expo/React Native for mobile. iOS builds remain a cloud or macOS-runner concern, never a hidden Windows-local dependency.
