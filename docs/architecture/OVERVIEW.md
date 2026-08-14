# Hero architecture overview

## Chosen shape

Hero is a modular monolith with isolated execution runners. The Control Plane owns coordination and policy; no UI or Provider adapter is allowed to bypass that policy.

```text
Persian Console
      |
      v
Control Plane (HTTP API)
      |
Application use cases
      |
Domain policy + Ports
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

The system is intentionally not a microservice fleet. Ports form the extraction boundary: an adapter may be replaced without changing the user flow or domain policy.

## Dependency rule

`experience -> application -> domain/ports <- adapters/execution`

Domain has no dependency on Provider CLIs, HTTP frameworks, database drivers or host paths. Execution never receives an authorization merely because a UI requested it; the Application layer validates the versioned snapshot first.

## Data, dispatch and lifecycle

HERO-005 defines PostgreSQL as the target source of truth for operational records, append-only events, authorization snapshots and durable outbox dispatch. HERO-006 adds the deterministic Run State Machine above that Event Log. HERO-007 adds the fail-closed authorization decision boundary and Global Stop. HERO-008 adds the isolated Runner boundary: a version-matched dispatch allocates a relative Worktree identity with closed-network defaults, checkpoint-before-cleanup and bounded concurrency. No independent queue is selected before its operational need is proven.

HERO-014 adds shared project memory above the dispatch boundary. It is not a raw chat transcript: each record is versioned, role-filtered and bounded to the current Project or exact Task/Step/document version. Context assembly is read-only and fail-closed for stale task memory, so an Agent cannot silently receive an obsolete design or unrelated project history.

HERO-015 adds the Planner and Router before dispatch. It converts a simple Persian request into an explicit product Spec, assumptions, acceptance criteria and a validated Task Graph. The Router makes every choice explainable: ChatGPT analyzes and designs, Codex implements and tests, Claude reviews independently, and Cursor receives only a human-controlled handoff. It does not connect to any provider in this stage.

HERO-016 adds the bounded Quality Gate after implementation: isolated Codex test evidence is recorded, deterministic Claude review is evaluated, and a finding can unlock only a separately authorized correction followed by retest. The gate records accounted cost units, caps correction cycles, and ends in `approved` or a safe `stopped` state. It is a policy and evidence boundary, not a hidden live-provider loop.

HERO-017 adds the Web Factory. A ready planning record and exact `develop` authorization produce a version-bound Blueprint and Feature Recipe for a Persian web application: Next.js/React/TypeScript, REST route handlers, a PostgreSQL adapter boundary, a separately configured authentication boundary, isolated Quality Gate evidence, and a Cursor handoff reference. It does not install a framework, invoke a provider, provision a database, configure authentication or publish a preview. Preview is visibly prepared but cannot dispatch without its own authorization; the active Snapshot for this step covers development and testing only.

HERO-018 adds the Mobile Factory alongside the Web Factory, with a separate native UI contract instead of reusing web UI. A ready plan and exact `develop` authorization create an Expo/React Native/TypeScript Blueprint and Recipe for Android and iOS, reusing only the versioned API and data boundaries. It records Android Preview as a separate Preview gate and iOS EAS/cloud build as a separately authorized external-spend gate. Neither Expo installation, mobile build, Preview nor cloud call happens in this step.

## Provider boundary

Codex/ChatGPT performs primary implementation, Claude performs independent review, and Cursor receives an IDE handoff. All three are provider adapters with no live credential or CLI connection in this step.

## Product-factory boundary

The orchestrator's own console is web-first. The apps it produces have two target presets: Next.js/React for web and Expo/React Native for mobile. iOS builds remain a cloud or macOS-runner concern, never a hidden Windows-local dependency.
