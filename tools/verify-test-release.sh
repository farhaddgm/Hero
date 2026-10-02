#!/usr/bin/env bash
# Read-only smoke test for the Hero Test boundary. No password is requested.
set -euo pipefail

readonly PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$PROJECT_ROOT/tools/release-json.sh"
EXPECTED_IMAGE=""
MANIFEST_FILE=""
while (($# > 0)); do
  case "$1" in
    --manifest) [[ $# -ge 2 ]] || { echo "--manifest requires a file." >&2; exit 1; }; MANIFEST_FILE="$2"; shift 2 ;;
    --help|-h) echo "Usage: verify-test-release.sh [--manifest FILE] IMAGE_DIGEST"; exit 0 ;;
    --*) echo "Unknown option: $1" >&2; exit 1 ;;
    *) [[ -z "$EXPECTED_IMAGE" ]] || { echo "Pass only one immutable image digest." >&2; exit 1; }; EXPECTED_IMAGE="$1"; shift ;;
  esac
done
if [[ -n "$MANIFEST_FILE" ]]; then
  [[ -f "$MANIFEST_FILE" && ! -L "$MANIFEST_FILE" ]] || { echo "Manifest must be a regular file." >&2; exit 1; }
  release_json_validate_manifest "$MANIFEST_FILE" || { echo "Invalid release manifest." >&2; exit 1; }
  EXPECTED_IMAGE="$(release_json_get "$MANIFEST_FILE" artifact)" || { echo "Invalid release manifest artifact." >&2; exit 1; }
fi
[[ "$EXPECTED_IMAGE" =~ ^ghcr\.io/farhaddgm/hero@sha256:[a-f0-9]{64}$ ]] || { echo "Pass the immutable Hero image digest or a valid release manifest." >&2; exit 1; }
actual="$(docker inspect hero-test-control-plane-1 --format '{{.Config.Image}}')"
[[ "$actual" == "$EXPECTED_IMAGE" ]] || { echo "Image mismatch: $actual" >&2; exit 1; }
curl --fail --silent --show-error http://127.0.0.1:43101/health
curl --fail --silent --show-error http://127.0.0.1:43101/ready
build_info="$(curl --fail --silent --show-error http://127.0.0.1:43101/build-info)"
[[ "$(release_json_get_text "$build_info" imageDigest)" == "$EXPECTED_IMAGE" ]] || { echo "Build info image digest mismatch." >&2; exit 1; }
expected_repository_context='read-only/1.0.0'
[[ "$(release_json_get_text "$build_info" smartTesterRepositoryContext)" == "$expected_repository_context" ]] || { echo "Build info is missing the Smart Tester repository read-only context." >&2; exit 1; }
[[ "$(release_json_get_text "$build_info" walkthroughGuideRepositoryContext)" == "$expected_repository_context" ]] || { echo "Build info is missing the Walk-Through repository read-only context." >&2; exit 1; }
for path in workspace project-control; do
  code="$(curl --silent --output /dev/null --write-out '%{http_code}' "http://127.0.0.1:43101/$path?projectId=project-vpn")"
  [[ "$code" == "401" ]] || { echo "$path expected 401 without Basic Auth, got $code" >&2; exit 1; }
done
echo "Hero Test smoke check: PASS"
