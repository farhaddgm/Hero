#!/usr/bin/env bash
# Read-only GHCR access preflight for one immutable Hero artifact.
set -euo pipefail

IMAGE_REF="${1:-}"
if [[ ! "$IMAGE_REF" =~ ^ghcr\.io/farhaddgm/hero@sha256:[a-f0-9]{64}$ ]]; then
  echo "GHCR PREFLIGHT: BLOCKED — pass ghcr.io/farhaddgm/hero@sha256:<64-hex-digest>" >&2
  exit 2
fi
command -v docker >/dev/null 2>&1 || { echo "GHCR PREFLIGHT: BLOCKED — Docker is not installed." >&2; exit 2; }
docker info >/dev/null 2>&1 || { echo "GHCR PREFLIGHT: BLOCKED — Docker daemon is unavailable." >&2; exit 2; }
if ! docker manifest inspect "$IMAGE_REF" >/dev/null 2>&1; then
  echo "GHCR PREFLIGHT: BLOCKED — authentication failed or artifact is unavailable." >&2
  echo "Use a GitHub Personal Access Token (classic) with read:packages; never paste it into this output." >&2
  exit 1
fi
echo "GHCR PREFLIGHT: PASS — immutable artifact is readable."
