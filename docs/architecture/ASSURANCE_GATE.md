# Assurance Gate

HERO-019 defines the portable assurance boundary that joins four control signals before a future release can be considered: local CI evidence, secret-safe security policy, local observability coverage and an explicit cost cap.

```text
exact test authorization
        |
        v
local pnpm check evidence + closed-network security evidence
        |
        +--> local event coverage + declared cost units
        |
        v
Assurance Gate: approved | blocked
        |
        v
release remains separately authorized
```

## Evidence policy

- CI means structured evidence of local checks such as `pnpm check`; this module does not dispatch GitHub Actions, a hosted runner or another CI provider.
- Security evidence must explicitly show no sensitive value and closed network access. Secret-shaped data and host paths are rejected before the assessment is recorded.
- Observability evidence must declare the append-only signals for blocked authorization, independent quality approval and completed runs. It is local evidence only; telemetry export is not configured.
- Cost uses declared, integer policy units. Evidence that exceeds the cap stops safely. Any external spend is rejected as separately authorized work.

## Boundary

The Assurance Gate is an in-memory domain contract and append-only event producer. It neither invokes Codex, ChatGPT, Claude or Cursor nor runs an external CI system. It does not configure credentials, send telemetry, publish an artifact, merge, release or deploy. A later provider adapter may implement those actions only behind their own authorization and cost controls.
