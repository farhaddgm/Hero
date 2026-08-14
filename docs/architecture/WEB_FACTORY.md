# Web Factory

## Purpose

The Web Factory is the portable product-factory boundary for Hero. It turns a ready planning record and a simple Persian request into two immutable, version-bound design outputs:

- a **Blueprint**, which fixes the web stack and operational boundaries;
- a **Feature Recipe**, which states routes, responsibilities, acceptance criteria and the Cursor handoff.

The first preset standardizes Next.js, React and TypeScript for the web user experience; Route Handlers and a versioned REST contract for the API; a PostgreSQL adapter boundary for data; and provider-neutral authentication configuration. These are target contracts, not installed dependencies or live infrastructure.

## Flow

```text
ready plan + exact develop authorization
               |
               v
versioned Blueprint + Feature Recipe
               |
               v
isolated Codex test evidence -> independent Claude Quality Gate review
               |
               v
tested factory output + Cursor human-controlled handoff
               |
               v
Preview authorization (separate, required before dispatch)
```

## Guardrails

- The factory uses portable IDs and relative workspace references only; it accepts no host path or secret.
- It makes no provider call, repository mutation, framework installation, database provisioning, authentication configuration, deployment, external spend or external publication.
- The Quality Gate remains the only route to a `tested` factory result. It requires version-matched `test` and `review` decisions, isolated evidence and an independent review.
- A Preview is not implied by development authority. The factory records a `PREVIEW_REQUIRES_SEPARATE_AUTHORIZATION` gate and never starts that dispatch itself.
- The produced application remains a separate package/worktree concern. Hero's control plane does not merge it into another project.
