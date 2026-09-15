#!/usr/bin/env bash
# Read-only smoke test for the Hero Test boundary. No password is requested.
set -euo pipefail

readonly PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
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
  EXPECTED_IMAGE="$(HERO_PROJECT_ROOT="$PROJECT_ROOT" node --input-type=module - "$MANIFEST_FILE" <<'NODE'
import fs from "node:fs";
const { validateReleaseManifest } = await import(new URL("packages/contracts/src/release-manifest.mjs", "file://" + process.env.HERO_PROJECT_ROOT + "/").href);
const manifest = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const errors = validateReleaseManifest(manifest);
if (errors.length) { console.error(errors.join(" ")); process.exit(1); }
console.log(manifest.artifact);
NODE
  )" || { echo "Invalid release manifest." >&2; exit 1; }
fi
[[ "$EXPECTED_IMAGE" =~ ^ghcr\.io/farhaddgm/hero@sha256:[a-f0-9]{64}$ ]] || { echo "Pass the immutable Hero image digest or a valid release manifest." >&2; exit 1; }
actual="$(docker inspect hero-test-control-plane-1 --format '{{.Config.Image}}')"
[[ "$actual" == "$EXPECTED_IMAGE" ]] || { echo "Image mismatch: $actual" >&2; exit 1; }
curl --fail --silent --show-error http://127.0.0.1:43101/health
curl --fail --silent --show-error http://127.0.0.1:43101/ready
build_info="$(curl --fail --silent --show-error http://127.0.0.1:43101/build-info)"
BUILD_INFO="$build_info" EXPECTED_IMAGE="$EXPECTED_IMAGE" node --input-type=module <<'NODE'
const info = JSON.parse(process.env.BUILD_INFO);
if (info.imageDigest !== process.env.EXPECTED_IMAGE) process.exit(1);
NODE
for path in workspace project-control; do
  code="$(curl --silent --output /dev/null --write-out '%{http_code}' "http://127.0.0.1:43101/$path?projectId=project-vpn")"
  [[ "$code" == "401" ]] || { echo "$path expected 401 without Basic Auth, got $code" >&2; exit 1; }
done
echo "Hero Test smoke check: PASS"
