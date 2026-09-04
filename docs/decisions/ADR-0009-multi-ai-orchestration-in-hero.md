# ADR-0009 — Multi-AI orchestration inside Hero

- Status: Accepted for deterministic foundation
- Date: 2026-08-30
- Roadmap step: HERO-014/015/016
- Source proposal: `ai-assistant/Wepod` multi-AI architecture v1.0

## Context

Hero already models a governed software organization with 11 teams, versioned Project Memory, Planner, Workflow, isolated Runner, Authorization, Quality Gate and Release controls. The supplied Multi-AI proposal adds replaceable Providers, Models, Agent Profiles, Context Assembly, Evaluators, Decision Makers and Invocation history.

The two designs overlap around orchestration, memory, evaluation and approvals. Keeping two independent control planes would create duplicate Runs, Memory, approvals and audit trails. Treating the 11 teams as AI roles would also mix organizational ownership with model capability.

## Decision

Keep Hero as the system of record and add Multi-AI as an internal domain subsystem within the existing modular monolith. Wepod/`ai-assistant` is represented as a Project/product managed by Hero.

The subsystem keeps these concepts independent:

```text
Team != AI Role != Agent Profile != Provider != Model != Credential
Run != AI Invocation
Evaluation != Approval
Decision Proposal != Authorization
```

Provider adapters implement a stable internal contract. Profiles bind a role to a Provider/Model plus Prompt, Context, Tool and Output policies. Each Invocation records a versioned Profile Snapshot and Context Snapshot. Evaluation produces Evidence. A Decision Proposal remains `draft` until the project owner resolves it; resolution never creates an Authorization implicitly.

The implementation includes runtime-configurable HTTP adapters for OpenAI Responses, Anthropic Messages, Google Gemini and OpenAI-compatible APIs. The default remains deterministic. A live call additionally requires a runtime credential, configured cost accounting and an active authorization verifier that matches the version-bound external-spend authorization, Step ID, Document Version and Global Stop state.

## Options considered

- Direct Provider SDK calls in Business Logic: rejected because role changes and provider replacement would be coupled to product code.
- LiteLLM as the domain core: rejected for the first phase; it may become a Provider Gateway implementation later.
- LangGraph/CrewAI as the domain core: rejected until real workflow complexity justifies the dependency and its semantics are mapped to Hero gates.
- A second Multi-AI control plane beside Hero: rejected because it duplicates Memory, Run, Approval and Audit sources of truth.
- Hero domain contracts plus replaceable adapters: accepted because it preserves current governance and enables future Provider choice.

## Consequences

- Existing Team Registry remains responsible for organizational ownership and readiness.
- Existing Workflow, Runner, Quality Gate and Authorization remain authoritative for execution and sensitive actions.
- AI roles can be mapped to many teams without changing team contracts.
- Provider, Model and Profile changes do not rewrite previous Invocation, Memory or Evidence records.
- PostgreSQL keeps append-only events as the source of truth and stores versioned Domain Registry snapshots as restart projections; the Control Plane hydrates its ten Domain registries plus dashboard state at startup and appends a new snapshot after successful commands.
- Node.js/ESM and JSON-compatible schemas remain the implementation path; a Python runtime is not introduced only for the proposal's example interface.
- Live Provider, external connectors, Secret Store integration, spend and Production remain separate authorized work.
