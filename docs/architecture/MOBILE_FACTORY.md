# Mobile Factory

## Purpose

The Mobile Factory is Hero's portable product-factory boundary for native mobile applications. It receives a ready planning record and a simple Persian request, then produces a version-bound Blueprint and Feature Recipe for a single Expo/React Native/TypeScript codebase targeting Android and iOS.

The factory deliberately reuses the application API and PostgreSQL-adapter contracts, but not web UI. Native screens, navigation and device behavior remain independent from the Web Factory.

## Flow

```text
ready plan + exact develop authorization
               |
               v
versioned Mobile Blueprint + Feature Recipe
               |
               v
isolated Codex test evidence -> independent Claude Quality Gate review
               |
               v
tested factory output + Cursor human-controlled handoff
               |                         |
               v                         v
Android Preview authorization     iOS cloud-build + external-spend authorization
```

## Guardrails

- The factory accepts portable identifiers, a Persian request and no secret or host path.
- It makes no provider call, repository mutation, Expo installation, data provisioning, authentication configuration, Android Preview, iOS cloud build, deployment or external spend.
- Quality Gate is the only route to a `tested` result. It requires exact `test` and `review` decisions, isolated evidence and independent review.
- Android Preview is not implied by development authority. It stays at `ANDROID_PREVIEW_REQUIRES_SEPARATE_AUTHORIZATION`.
- iOS cloud build is not a local Windows workaround: it stays at `IOS_CLOUD_BUILD_REQUIRES_SEPARATE_AUTHORIZATION`, because it can create external spend and needs a separately authorized runner or cloud account.
