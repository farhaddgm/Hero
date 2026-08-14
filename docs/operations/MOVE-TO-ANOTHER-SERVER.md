# Moving Hero to another server

## Purpose and authorization boundary

This runbook is an operator checklist, not an automatic deployment script. A successful `PORTABILITY_VERIFIED` record proves that a versioned package has the required evidence. Copying a repository, touching a backup, writing secrets, provisioning a host, starting containers, public exposure and production operation each still require separate authorization.

## Destination prerequisites

- A clean Linux host with Docker Engine and Compose.
- Access to the independent Hero repository and the approved Git revision.
- A project-scoped secure channel for destination environment values; do not put values in Git, the run log or this document.
- Isolated disk storage for `hero-data`; do not reuse another project's volume, network, port or service.
- A backup artifact identified by a SHA-256 checksum, plus a restore record for the same checksum.

## Approved operator sequence

1. Confirm the exact Step ID, document version, authorization and Global Stop state.
2. Clone the independent repository and checkout the approved revision on the destination.
3. Create destination-only environment values from `.env.example` through the approved secret channel. Do not copy an old `.env` blindly.
4. Build the Linux container with Compose and run the repository checks in the build context.
5. Verify the backup checksum before restore. Restore only into the `hero-data` destination volume.
6. Verify the restored checksum and migration state. Record that evidence with the same artifact ID and checksum.
7. Start the approved Compose stack and check `/health` and `/ready` from the intended private boundary.
8. Record the outcome, rollback point and any failure. Do not expose, release or operate the destination without its own authorization.

## Current limitation

The current development environment has no Docker daemon, no clean Linux runtime and no persistent operational database. The codebase therefore contains the fail-closed readiness contract and tests, but no real backup or clean-Linux restore has been executed here. That missing evidence must remain `LINUX_CLEANROOM_VERIFICATION_REQUIRED`; it cannot be converted to success by a local unit test.
