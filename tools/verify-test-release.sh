#!/usr/bin/env bash
# Read-only smoke test for the Hero Test boundary. No password is requested.
set -euo pipefail

readonly EXPECTED_IMAGE="${1:-}"
[[ "$EXPECTED_IMAGE" =~ ^ghcr\.io/farhaddgm/hero@sha256:[a-f0-9]{64}$ ]] || { echo "Pass the immutable Hero image digest." >&2; exit 1; }
actual="$(docker inspect hero-test-control-plane-1 --format '{{.Config.Image}}')"
[[ "$actual" == "$EXPECTED_IMAGE" ]] || { echo "Image mismatch: $actual" >&2; exit 1; }
curl --fail --silent --show-error http://127.0.0.1:43101/health
curl --fail --silent --show-error http://127.0.0.1:43101/ready
for path in workspace project-control; do
  code="$(curl --silent --output /dev/null --write-out '%{http_code}' "http://127.0.0.1:43101/$path?projectId=project-vpn")"
  [[ "$code" == "401" ]] || { echo "$path expected 401 without Basic Auth, got $code" >&2; exit 1; }
done
echo "Hero Test smoke check: PASS"
