# Portability architecture

HERO-020 adds a deterministic Portability Gate. It records whether a proposed transfer package has the evidence required for a clean Linux move; it does not execute backup, restore, host setup, container startup, or repository transfer.

## Four boundaries

1. **Source:** one independent Git repository, without submodules, local dependencies, references to another project, or host-specific paths.
2. **Configuration:** runtime configuration is `HERO_` environment variables only. `.env.example` documents names, never values or credentials.
3. **Runtime:** `compose.yaml` and the pinned image define Linux as the reference runtime. Hero resources stay project-scoped (`hero-data` and `hero-private`).
4. **Data:** a backup proof must be project-scoped, secret-free and bound to a SHA-256 checksum. Restore evidence must match that same checksum and confirm migrations.

## Readiness flow

```text
exact test authorization
        -> source boundary
        -> Linux runtime contract
        -> backup checksum evidence
        -> restore checksum + migration evidence
        -> clean Linux verification
        -> PORTABILITY_VERIFIED
        -> transfer requires separate authorization
```

The gate fails closed. Missing source, runtime, backup, restore or clean Linux evidence produces a specific blocked code. `PORTABILITY_VERIFIED` is a versioned readiness record, not permission to touch a server.

The local Node workflow is for fast development. A real clean Linux restore must be run in an approved target environment and produce fresh evidence. Provider credentials, databases, queues and artifact storage remain behind explicit adapters; their backup policies will be added only when those adapters are approved and implemented.
