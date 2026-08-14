# Isolated runner boundary

The isolated runner is a deterministic execution boundary, not an Agent client. It accepts an already-authorized development dispatch and allocates exactly one scoped workspace for that Run.

```text
Authorization decision
        ↓ exact Step/version/develop match
Runner prepare
        ↓ relative worktree key + branch plan + closed network
Runner start
        ↓
Safe checkpoint request → checkpoint → cancel/fail → cleanup
```

## Ownership and safety

The Runner owns only its `workspaceKey`, never the primary repository working directory. It keeps the base ref read-only and enforces one active runner per task. The current default is one total runner, which matches the development machine's resource budget and prevents accidental parallel mutation.

The worktree port is deliberately injected. The deterministic in-memory port proves lifecycle behavior in tests. The Git Worktree port composes a detached worktree plus task branch only through a supplied executor, preserves the same relative-path validation, avoids forceful removal and requires a clean workspace before deletion. The Control Plane does not instantiate that executor yet.

## Global Stop and checkpoints

Authorization is checked at prepare and again at start. A Global Stop does not authorize a new Runner. An already-running Runner becomes safe only after it records a checkpoint; it cannot be directly cancelled or cleaned while it may still be changing files.

## Non-goals

This boundary does not invoke Codex, Claude, Cursor, Docker, a shell, database, queue, network or secret from the Control Plane. The Git adapter is present but not wired to a live executor. Those effects require separately verified runtime permissions and may not bypass this contract.
