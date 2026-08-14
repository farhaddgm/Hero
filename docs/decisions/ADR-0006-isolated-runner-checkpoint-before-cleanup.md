# ADR-0006 — Isolated Runner and checkpoint-before-cleanup

## Context

Hero needs parallel development later, but allowing several agents to edit the primary checkout would make the result non-deterministic and hard to recover. A Global Stop must also stop new work without deleting or interrupting a file operation at an unsafe point.

## Decision

Each Run receives one relative Worktree identity, one task-scoped branch identity and bounded resources. The default network is disabled and the base ref is read-only. The Runner requires the exact authorized dispatch decision at both prepare and start.

A running Runner cannot be cancelled or cleaned directly. It must request and record a safe checkpoint first. Timeout becomes a typed failure event; cleanup is permitted only after checkpoint, cancellation or failure.

## Consequences

- Worktree lifecycle is testable without a provider or host-side Git mutation.
- A future Git/container adapter has a narrow port and cannot broaden authorization.
- Cleanup never silently deletes an active workspace.
- Real provider execution remains separately scoped and must not bypass this boundary.
