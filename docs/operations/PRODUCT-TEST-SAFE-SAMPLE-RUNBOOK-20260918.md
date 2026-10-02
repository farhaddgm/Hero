# HERO-OPS-PRODUCT-TEST-SAFE-SAMPLE

> Document ID: `HERO-OPS-PRODUCT-TEST-SAFE-SAMPLE`
> Canonical path: `docs/operations/PRODUCT-TEST-SAFE-SAMPLE-RUNBOOK-20260918.md`
> Title: Runbook چرخهٔ امن Product Test برای نمونهٔ بی‌خطر
> Type: operation
> Scope: cross-project
> Status: active
> Version: 1.1.0
> Owner: hero-product
> Review cadence: per-change
> Supersedes: none
> Superseded by: none

Version: 1.1.0
Environment: Test only  
Authorization: `PRODUCT-TEST-20260918-001`  
Step scope: `PF3-PRODUCT-TEST-001` through `PF3-PRODUCT-TEST-005`

## Purpose

این runbook چرخهٔ واقعی Product Test را با یک image نمونهٔ بی‌خطر و executor رسمی Product Runner اثبات می‌کند. نمونه فقط دو فایل ثابت و یک آزمون read-only دارد؛ نه پورت باز می‌کند، نه شبکه، volume، host mount، Secret، Provider زنده یا هزینهٔ خارجی دارد. اجرای مرجع از `tools/run-product-test-official.mjs`، `createDockerProductRunner` و `createDockerProductExecutor` استفاده می‌کند.

## Required boundary

- Docker project: `hero-product-safe-sample-<run-id>`
- Product resources must be namespaced under `hero-product-*`.
- `network_mode: none`, non-root, read-only filesystem, `no-new-privileges`, all capabilities dropped, CPU/RAM/PID limits.
- The image used by `start` must be an immutable digest and must match the artifact manifest.
- Hero Test, Hero Production, Pilot and unrelated containers must not be restarted, stopped, reconfigured or reused.
- Output evidence may contain only project/run identifiers, image digest, exit codes, health state, durations, byte counts and checksums. No prompt, secret or raw provider output is allowed.

## Lifecycle

1. Validate this authorization, `globalStop=false`, exact Step ID/document version and a collision-free Docker project.
2. Build the sample with pull disabled and network disabled.
3. Run `/opt/product/test` in a one-shot container with no network, no dependency and no build.
4. Start the immutable image detached.
5. Wait for the image health check and verify the container belongs only to the Product Test project.
6. Stop the sample, then run idempotent cleanup on only its own project resources; cleanup must also work after stop has released the runtime reservation.
7. Verify no sample container, network, workspace or mutable build tag remains; retain only the final immutable image reference and redacted evidence, then re-check Hero health without restarting it.

Rollback for this Test-only sample is fail-safe: stop and remove only the sample project. The final immutable image and its redacted evidence bundle are retained as Test artifacts; failed/obsolete local build tags may be removed by the same scoped cleanup. No Hero or external target rollback is implied or authorized.
