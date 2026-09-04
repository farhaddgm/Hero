# Recovery evidence — 2026-08-30

## Scope

This record covers a disposable, non-production PostgreSQL backup and restore test. It does not authorize a server transfer, production operation, secret change or external spend.

## Result

- Artifact: `hero-recovery-check`
- Source database: temporary `hero_source`
- Restore database: temporary `hero_restore`
- Format: PostgreSQL custom dump
- Checksum: `sha256:0f9ffd2c9e7a0016edab2aa3bdabc9815c24fd0ff914b3ae6dd8507c81744558`
- Verification: restored sentinel `source-ok`
- Result: `HERO BACKUP RESTORE PASS`

## Boundary

The test used only a synthetic sentinel and disposable resources prefixed with `hero-`. It did not read or alter the project's operational database, copy secrets, provision a host, start the project Compose stack, or perform a transfer. Destination cleanroom evidence and the approved operational backup remain separate requirements.

## Latest disposable verification — 2026-09-05

- Artifact: `hero-recovery-check-20260905`;
- Source/restore: temporary `hero_source` → temporary `hero_restore`;
- Format: PostgreSQL custom dump;
- Checksum: `sha256:1ce262c482e6096d7c315d62c3483ba012a9f1e813e57f2d0fcfe5c29ccffb04`;
- Verification: restored sentinel `source-ok` and checksum re-read matched;
- Result: `HERO BACKUP RESTORE PASS`;
- Boundary: both containers/network were disposable, prefixed `hero-`, and automatically removed. This does not replace recovery evidence from a clean operational Linux destination or a real approved backup.
