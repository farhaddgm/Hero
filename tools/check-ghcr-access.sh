#!/usr/bin/env bash
# Read-only GHCR access preflight for one immutable Hero artifact.
set -euo pipefail

readonly PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$PROJECT_ROOT/tools/release-json.sh"

IMAGE_REF=""
MANIFEST_FILE=""
while (($# > 0)); do
  case "$1" in
    --manifest) [[ $# -ge 2 ]] || { echo "--manifest requires a file." >&2; exit 2; }; MANIFEST_FILE="$2"; shift 2 ;;
    --help|-h) echo "Usage: check-ghcr-access.sh IMAGE_DIGEST | --manifest FILE"; exit 0 ;;
    --*) echo "Unknown option: $1" >&2; exit 2 ;;
    *) [[ -z "$IMAGE_REF" ]] || { echo "Pass only one immutable image digest." >&2; exit 2; }; IMAGE_REF="$1"; shift ;;
  esac
done
if [[ -n "$MANIFEST_FILE" ]]; then
  release_json_validate_manifest "$MANIFEST_FILE" || { echo "GHCR PREFLIGHT: BLOCKED — invalid release manifest." >&2; exit 2; }
  IMAGE_REF="$(release_json_get "$MANIFEST_FILE" artifact)" || { echo "GHCR PREFLIGHT: BLOCKED — unreadable manifest artifact." >&2; exit 2; }
fi
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
