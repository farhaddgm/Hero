# ADR-0002 — Modular monolith and adapter ports

- Status: Accepted
- Date: 2026-08-14
- Roadmap step: HERO-003

## Context

Hero needs rapid progress for a non-developer owner while orchestrating three AI tools, isolated code execution, evidence and future web/mobile application factories. Starting with a microservice architecture would add deployment, tracing, networking and data-consistency costs before there is evidence that independent services are needed.

## Decision

Use a modular monolith Control Plane with explicit Application, Domain, Ports and Adapter boundaries. Put command execution, worktree access and Provider interaction in isolated Runners. Choose PostgreSQL as the future operational store and durable outbox boundary; do not introduce a separate queue in the initial architecture.

The initial external roles are fixed: Codex/ChatGPT as primary implementation, Claude as independent reviewer, Cursor as IDE handoff. No live provider integration is implied by this decision.

## Consequences

- The product can be delivered and debugged as one deployable Control Plane while retaining extraction boundaries.
- Every external technology is behind a Port, limiting migration cost and preventing host-specific coupling.
- Independent scaling or service extraction requires a later ADR with observed need.
- Runner isolation, version-bound authorization and fail-closed checks remain mandatory regardless of deployment topology.
