# HERO-EVIDENCE-PRODUCT-FACTORY-PF3-20260918

> Document ID: `HERO-EVIDENCE-PRODUCT-FACTORY-PF3-20260918`
> Canonical path: `docs/evidence/PRODUCT-FACTORY-PF3-20260918.md`
> Title: Evidence اجرای Product Test نمونهٔ بی‌خطر — PF-3
> Type: evidence
> Scope: hero
> Status: active
> Version: 1.0.0
> Owner: hero-product
> Review cadence: per-change
> Supersedes: none
> Superseded by: none

Version: 1.1.0
Status: `verified-test-sample; owner-acceptance-pending`
Authorization: `PRODUCT-TEST-20260918-001`  
Environment: Test only  
Product: `safe-sample`

## Actual Test evidence

- Authorization: `PRODUCT-TEST-20260918-001`
- Step/document: `PF3-PRODUCT-TEST-001` / `1.0.0`
- Run: `20260918061633`
- Source commit: `000389632db4644c9288afe69acea42b42383dc1`
- Compose project: `hero-product-safe-sample-20260918061633`
- Artifact: `hero-product-safe-sample@sha256:5190827dfc642ffc4d97518de450083890eb3c50f6ac91e3eda18a772d921ef7`
- Environment: `test`
- Network: `none`
- Health: `healthy`

| Check | Result |
|---|---|
| build | PASS |
| immutable artifact manifest validation | PASS |
| one-shot Product Test | PASS |
| start | PASS |
| health check | PASS |
| stop | PASS |
| cleanup | PASS |
| rollback to no sample runtime | PASS |
| Hero Test/Production no-impact comparison | PASS |

Artifact evidence digests:

- SBOM SPDX: `sha256:5651d4377d5385a48c7c0e1062ba9371c889aeae064c7667bc0aa398a9a65c69`
- in-toto/SLSA attestation: `sha256:d56636c5b1bff53e001f53ad55362a06743d8b84d857d3364a63c622b26fcef3`
- redacted test evidence: `sha256:f46fc1f263d94f5a40577dc5c32e413ff534d65a2543045730345aa9535d16f5`

The retained redacted bundle is `/tmp/hero-product-test-evidence-20260918061633/` on the Test host. It contains no secret, prompt, Provider response or raw process output.

## Boundary and remaining gate

This evidence proves the isolated Test runtime lifecycle for the harmless sample. It does not claim Product Production, Pilot, a live Provider, external spend, or owner acceptance. The host used a controlled Test-only Docker harness because the host does not provide Node/pnpm for invoking the Control Plane's Node executor directly; connecting the official executor to this runtime and promoting the new source release remain the next PF-2/PF-3 integration gate.

Expected evidence fields: run ID, source commit, immutable image digest, artifact-manifest digests, action statuses and exit codes, health state, timings, cleanup state, Hero health before/after, and non-interference checks. Raw stdout/stderr, secrets, prompts and Provider responses are excluded.
