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

## Provider boundary

Codex/ChatGPT performs primary implementation, Claude performs independent review, and Cursor receives an IDE handoff. All three are provider adapters with no live credential or CLI connection in this step.

## Product-factory boundary

The orchestrator's own console is web-first. The apps it produces have two target presets: Next.js/React for web and Expo/React Native for mobile. iOS builds remain a cloud or macOS-runner concern, never a hidden Windows-local dependency.
