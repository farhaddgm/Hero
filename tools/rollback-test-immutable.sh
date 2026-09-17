#!/usr/bin/env bash
# Roll back the last Hero Test promotion using metadata-only state.
set -Eeuo pipefail
readonly PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
readonly PROJECT_NAME="hero-test"
source "$PROJECT_ROOT/tools/release-json.sh"
ENV_FILE="${HERO_TEST_ENV_FILE:-/etc/hero/hero-test.env}"
STATE_FILE="${HERO_TEST_RELEASE_STATE_FILE:-${ENV_FILE}.release-state}"

fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
note() { printf 'Hero Test rollback: %s\n' "$*"; }
assert_parent() {
  local p; p="$(dirname -- "$1")"; [[ -d "$p" ]] || fail "Parent directory is missing: $p"
  while [[ "$p" != "/" && "$p" != "." ]]; do
    [[ ! -L "$p" ]] || fail "Path component is a symlink: $p"
    p="$(dirname -- "$p")"
  done
}
assert_regular_file() { [[ -f "$1" && ! -L "$1" ]] || fail "Expected a regular non-symlink file: $1"; }
validate_digest() { [[ "$1" =~ ^ghcr\.io/farhaddgm/hero@sha256:[a-f0-9]{64}$ ]] || fail "Rollback state does not contain an immutable Hero digest."; }

assert_regular_file "$ENV_FILE"
assert_regular_file "$STATE_FILE"
assert_parent "$ENV_FILE"
assert_parent "$STATE_FILE"
[[ "$ENV_FILE" != *production* ]] || fail "Refusing a production-named environment file."
command -v docker >/dev/null 2>&1 || fail "Docker is required on the Hero server."
docker info >/dev/null 2>&1 || fail "Docker access is required; use a Docker-enabled account."

release_json_require_parser || fail "A JSON parser (jq or python3) is required on the Test host."
STATE_SCHEMA="$(release_json_get "$STATE_FILE" schema)" || fail "The release state is unreadable."
STATE_ENVIRONMENT="$(release_json_get "$STATE_FILE" environment)" || fail "The release state is unreadable."
STATE_STATUS="$(release_json_get "$STATE_FILE" status)" || fail "The release state is unreadable."
[[ "$STATE_SCHEMA" == 'hero.test-release-state/v1' && "$STATE_ENVIRONMENT" == 'test' && "$STATE_STATUS" == 'promoted' ]] || fail "The release state is invalid or is not a promotable state."
CURRENT_IMAGE="$(release_json_get "$STATE_FILE" currentImage)" || fail "The current image is unreadable."
PREVIOUS_IMAGE="$(release_json_get "$STATE_FILE" previousImage)" || fail "The previous image is unreadable."
PREVIOUS_VERSION="$(release_json_get "$STATE_FILE" previousReleaseVersion)" || fail "The previous release version is unreadable."
PREVIOUS_COMMIT="$(release_json_get "$STATE_FILE" previousSourceCommit)" || fail "The previous source commit is unreadable."
PREVIOUS_DIGEST="$(release_json_get "$STATE_FILE" previousImageDigest)" || fail "The previous image digest is unreadable."
validate_digest "$CURRENT_IMAGE"
validate_digest "$PREVIOUS_IMAGE"
[[ "$PREVIOUS_DIGEST" == "$PREVIOUS_IMAGE" || -z "$PREVIOUS_DIGEST" ]] || fail "Rollback metadata has an inconsistent previous digest."
CURRENT_ENV_IMAGE="$(grep -m1 -E '^HERO_IMAGE=' "$ENV_FILE" | sed 's/^HERO_IMAGE=//' || true)"
[[ "$CURRENT_ENV_IMAGE" == "$CURRENT_IMAGE" ]] || fail "Test environment does not match the last recorded release state; inspect before rollback."

update_env() {
  local image="$1" version="$2" commit="$3" digest="$4" tmp
  tmp="$(mktemp "${ENV_FILE}.tmp.XXXXXX")"
  chmod 600 "$tmp"
  awk -v image="$image" -v version="$version" -v commit="$commit" -v digest="$digest" '
    BEGIN { i=0; v=0; c=0; d=0 }
    /^HERO_IMAGE=/ { print "HERO_IMAGE=" image; i=1; next }
    /^HERO_RELEASE_VERSION=/ { print "HERO_RELEASE_VERSION=" version; v=1; next }
    /^HERO_SOURCE_COMMIT=/ { print "HERO_SOURCE_COMMIT=" commit; c=1; next }
    /^HERO_IMAGE_DIGEST=/ { print "HERO_IMAGE_DIGEST=" digest; d=1; next }
    { print }
    END { if (!i) print "HERO_IMAGE=" image; if (!v) print "HERO_RELEASE_VERSION=" version; if (!c) print "HERO_SOURCE_COMMIT=" commit; if (!d) print "HERO_IMAGE_DIGEST=" digest }
  ' "$ENV_FILE" > "$tmp"
  mv -f -- "$tmp" "$ENV_FILE"
}
write_state() {
  local target="$1"
  HERO_STATE_FILE="$target" HERO_STATE_CURRENT="$PREVIOUS_IMAGE" HERO_STATE_PREVIOUS="$CURRENT_IMAGE" \
  HERO_STATE_VERSION="$PREVIOUS_VERSION" HERO_STATE_COMMIT="$PREVIOUS_COMMIT" release_json_write_rollback_state "$target" || fail "Could not write rollback state."
}

cd "$PROJECT_ROOT"
docker compose --project-name "$PROJECT_NAME" --env-file "$ENV_FILE" --profile postgres config --quiet
note "pulling the previous immutable image"
docker pull "$PREVIOUS_IMAGE"
update_env "$PREVIOUS_IMAGE" "$PREVIOUS_VERSION" "$PREVIOUS_COMMIT" "$PREVIOUS_IMAGE"
docker compose --project-name "$PROJECT_NAME" --env-file "$ENV_FILE" --profile postgres up -d --no-deps --no-build --force-recreate control-plane
for attempt in $(seq 1 30); do
  if curl --fail --silent --show-error --max-time 3 http://127.0.0.1:43101/ready >/dev/null; then break; fi
  [[ "$attempt" -eq 30 ]] && fail "Hero Test did not become ready after rollback."
  sleep 2
done
ACTUAL_IMAGE="$(docker inspect hero-test-control-plane-1 --format '{{.Config.Image}}')"
[[ "$ACTUAL_IMAGE" == "$PREVIOUS_IMAGE" ]] || fail "Rollback container image mismatch."
write_state "$STATE_FILE"
note "SUCCESS — Test restored to $PREVIOUS_IMAGE"
