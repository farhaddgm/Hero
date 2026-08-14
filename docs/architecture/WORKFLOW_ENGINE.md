# Hero workflow engine

## Responsibility

The workflow engine is the deterministic domain boundary for a Run lifecycle. It knows states and legal transitions, but it does not call an Agent, execute a shell command, create a worktree, or make a deployment decision.

## Command path

```text
Command + idempotency key + expected version
        ↓
Workflow transition validation
        ↓
Safe operational Event append
        ↓
Immutable Run projection
        ↓
Future transactional Outbox dispatch
```

The Event Log remains the source of truth. The in-memory projection exists only for deterministic tests; PostgreSQL will later hold the durable projection and Event/Outbox transaction.

## Safe checkpoints

`pause` persists the previous state as `resumeState`; it does not assume that a host process can be stopped at an arbitrary instruction. The future Runner must report a safe checkpoint before the application layer issues the pause transition. `resume` returns only to that stored state.

## Review and retry

Review is a first-class state, so delivery cannot silently jump from Running to Completed. A reviewer can approve or request changes. A Failed Run may only return through Queued with an incremented retry counter, allowing the future quality loop to impose a retry and budget limit.

## Non-goals

This module does not grant authorization, invoke a provider, dispatch an Outbox message, expose operational Run records, or bypass the separately-gated sensitive actions. Those responsibilities remain in later application, runner and authorization steps.
