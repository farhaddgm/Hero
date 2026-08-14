# Hero authorization engine

## Responsibility

The authorization engine is the fail-closed decision boundary before a future Runner dispatches work. It does not infer permission from a UI state, a broad natural-language instruction, or a previous successful Run.

## Exact match rule

```text
authorization id
  + active status
  + exact Step ID
  + exact approved document version
  + explicitly granted development operation
  + Global Stop clear
  = dispatch allowed
```

Any missing value, stale version, revoked record, unknown operation or unexpected state produces a structured denial. Sensitive operations are denied before an ordinary authorization can be considered.

## Snapshot and revocation

Batch authority is an immutable collection of explicit `(stepId, documentVersion)` entries. A new row, a changed document version or an inserted roadmap item does not silently enlarge it. Grant and revoke are typed append-only events; the current in-memory record is a deterministic projection for tests.

## Global Stop

Global Stop prevents all new dispatches. Its decision result marks `safeCheckpointRequired`, allowing the future application/runner layer to pause an active run at its next declared safe checkpoint. Clearing it is a separate explicit project-owner command; no automatic clear path exists.

## Boundary

Only the project-owner actor may grant, revoke, activate or clear Global Stop. The engine merely answers and records a decision; it does not invoke providers, change secrets, stop a host process, deploy, spend money or send a message.
