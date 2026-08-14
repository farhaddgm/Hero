# Hero agent boundary

This repository is a clean-room project. Every human and AI agent must obey these rules.

1. Treat the Git top-level directory as the only readable and writable project boundary.
2. Never enumerate, read, import, link, copy, or execute files from parent or sibling projects.
3. Stop when a requested target resolves outside the Git top-level directory.
4. Do not add symlinks, junctions, Git submodules, local path dependencies, or host-specific paths.
5. Keep configuration in environment variables. Commit examples only; never commit secrets.
6. Prefix runtime resources with hero and do not reuse databases, volumes, queues, ports, or service names owned by another project.
7. Use Linux containers as the reference runtime. Keep local Node workflows cross-platform.
8. Production deploys, destructive actions, external messages, purchases, and secret changes always require separate authorization.
9. Run pnpm check before handing work off.
10. Update project evidence only after tests report their real result.
11. Before dispatch, validate the Step ID and document version against the active authorization snapshot and confirm Global Stop is off.
12. Treat production, destructive data operations, external spend, secret changes, external messages, and irreversible actions as separately gated.
13. When the owner revokes full authority, stop new dispatch immediately, pause at a safe checkpoint, and version the authorization record instead of silently editing history.
