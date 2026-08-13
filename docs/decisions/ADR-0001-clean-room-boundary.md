# ADR-0001 — Clean-room repository boundary

- Status: Accepted
- Date: 2026-08-14
- Roadmap step: HERO-004

## Context

The host contains another developed project. Hero must be removable and transferable without inheriting that project's code or runtime state.

## Decision

The Git top-level directory is Hero's hard project boundary. Agents do not enumerate or read parent and sibling directories. Symlinks, junctions, submodules, host-local dependencies, shared runtime resource names, and host-specific paths are forbidden. The reference runtime is a self-contained Linux container configured through HERO_ environment variables.

## Consequences

- A missing capability must be implemented or declared explicitly; it cannot be borrowed from a sibling project.
- Portability checks run locally and in CI.
- Secrets and persistent data remain outside Git and require a separate migration or restore step.
- Container verification is pending until Docker is available in an approved environment.
