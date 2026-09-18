#!/usr/bin/env bash
# Promote one immutable GHCR artifact to Hero Test only. No Production access.
set -Eeuo pipefail

readonly PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
readonly PROJECT_NAME="hero-test"
source "$PROJECT_ROOT/tools/release-json.sh"
ENV_FILE="${HERO_TEST_ENV_FILE:-/etc/hero/hero-test.env}"
STATE_FILE="${HERO_TEST_RELEASE_STATE_FILE:-${ENV_FILE}.release-state}"
MANIFEST_FILE=""
IMAGE_REF=""
RELEASE_VERSION=""
SOURCE_COMMIT=""
RELEASE_URL=""
PROMOTION_ACTIVE=0

fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
note() { printf 'Hero Test promotion: %s\n' "$*"; }
usage() {
  printf '%s\n' 'Usage: promote-test-immutable.sh [--manifest FILE] [--env-file FILE] [--state-file FILE] IMAGE_DIGEST'
  printf '%s\n' 'Digest must be ghcr.io/farhaddgm/hero@sha256:<64 lowercase hex characters>.'
}

while (($# > 0)); do
  case "$1" in
    --manifest) [[ $# -ge 2 ]] || fail "--manifest requires a file"; MANIFEST_FILE="$2"; shift 2 ;;
    --env-file) [[ $# -ge 2 ]] || fail "--env-file requires a file"; ENV_FILE="$2"; shift 2 ;;
    --state-file) [[ $# -ge 2 ]] || fail "--state-file requires a file"; STATE_FILE="$2"; shift 2 ;;
    --help|-h) usage; exit 0 ;;
    --*) fail "Unknown option: $1" ;;
    *) [[ -z "$IMAGE_REF" ]] || fail "Pass only one image digest"; IMAGE_REF="$1"; shift ;;
  esac
done

assert_parent() {
  local target="$1" parent
  parent="$(dirname -- "$target")"
  [[ -d "$parent" ]] || fail "Parent directory is missing: $parent"
  while [[ "$parent" != "/" && "$parent" != "." ]]; do
    [[ ! -L "$parent" ]] || fail "Path component is a symlink: $parent"
    parent="$(dirname -- "$parent")"
  done
}
assert_regular_file() {
  local target="$1"
  [[ -f "$target" && ! -L "$target" ]] || fail "Expected a regular non-symlink file: $target"
}
assert_unique_env_keys() {
  local duplicate_keys
  duplicate_keys="$(awk '
    /^[[:space:]]*#/ || /^[[:space:]]*$/ { next }
    {
      line=$0
      sub(/^[[:space:]]*export[[:space:]]+/, "", line)
      sub(/[[:space:]]*=.*/, "", line)
      if (line ~ /^[A-Za-z_][A-Za-z0-9_]*$/ && ++seen[line] == 2) print line
    }
  ' "$ENV_FILE" | sort -u)"
  [[ -z "$duplicate_keys" ]] || fail "Environment file contains duplicate key names; first duplicate: ${duplicate_keys%%$'\n'*}"
}
assert_new_or_regular() {
  local target="$1"
  assert_parent "$target"
  if [[ -e "$target" || -L "$target" ]]; then assert_regular_file "$target"; fi
}
validate_digest() {
  [[ "$1" =~ ^ghcr\.io/farhaddgm/hero@sha256:[a-f0-9]{64}$ ]] || fail "Pass one immutable Hero image digest, never a tag."
}

if [[ -n "$MANIFEST_FILE" ]]; then
  assert_regular_file "$MANIFEST_FILE"
  release_json_validate_manifest "$MANIFEST_FILE" || fail "Release manifest is invalid or unreadable."
  MANIFEST_ARTIFACT="$(release_json_get "$MANIFEST_FILE" artifact)" || fail "Release manifest artifact is unreadable."
  MANIFEST_VERSION="$(release_json_get "$MANIFEST_FILE" releaseVersion)" || fail "Release manifest version is unreadable."
  MANIFEST_COMMIT="$(release_json_get "$MANIFEST_FILE" commitSha)" || fail "Release manifest commit is unreadable."
  MANIFEST_URL="$(release_json_get "$MANIFEST_FILE" releaseUrl)" || fail "Release manifest URL is unreadable."
  if [[ -n "$IMAGE_REF" && "$IMAGE_REF" != "$MANIFEST_ARTIFACT" ]]; then fail "CLI digest does not match the release manifest artifact."; fi
  IMAGE_REF="$MANIFEST_ARTIFACT"
  RELEASE_VERSION="$MANIFEST_VERSION"
  SOURCE_COMMIT="$MANIFEST_COMMIT"
  RELEASE_URL="$MANIFEST_URL"
fi

validate_digest "$IMAGE_REF"
assert_regular_file "$ENV_FILE"
[[ "$ENV_FILE" != *production* ]] || fail "Refusing a production-named environment file."
assert_unique_env_keys
assert_new_or_regular "$STATE_FILE"
command -v docker >/dev/null 2>&1 || fail "Docker is required on the Hero server."
docker info >/dev/null 2>&1 || fail "Docker access is required; use a Docker-enabled account."

get_env_value() {
  local key="$1" line
  line="$(grep -m1 -E "^${key}=" "$ENV_FILE" || true)"
  printf '%s' "${line#*=}"
}
readonly PREVIOUS_IMAGE="$(get_env_value HERO_IMAGE)"
readonly PREVIOUS_RELEASE_VERSION="$(get_env_value HERO_RELEASE_VERSION)"
readonly PREVIOUS_SOURCE_COMMIT="$(get_env_value HERO_SOURCE_COMMIT)"
readonly PREVIOUS_IMAGE_DIGEST="$(get_env_value HERO_IMAGE_DIGEST)"
[[ -n "$PREVIOUS_IMAGE" ]] || fail "Test environment has no HERO_IMAGE; refusing a non-reversible promotion."
[[ "$PREVIOUS_IMAGE" =~ ^ghcr\.io/farhaddgm/hero@sha256:[a-f0-9]{64}$ ]] || fail "Existing Test image is not immutable; pin HERO_IMAGE to a digest before promoting."
# A direct digest invocation has no release metadata; preserve the existing values
# instead of erasing them. A manifest invocation has already supplied authoritative values.
if [[ -z "$RELEASE_VERSION" ]]; then RELEASE_VERSION="$PREVIOUS_RELEASE_VERSION"; fi
if [[ -z "$SOURCE_COMMIT" ]]; then SOURCE_COMMIT="$PREVIOUS_SOURCE_COMMIT"; fi

write_record() {
  local target="$1" status="$2" current="$3" previous="$4" backup="$5"
  assert_new_or_regular "$target"
  HERO_RECORD_FILE="$target" HERO_RECORD_STATUS="$status" HERO_RECORD_VERSION="$RELEASE_VERSION" \
  HERO_RECORD_COMMIT="$SOURCE_COMMIT" HERO_RECORD_RELEASE_URL="$RELEASE_URL" HERO_RECORD_CURRENT="$current" \
  HERO_RECORD_PREVIOUS="$previous" HERO_RECORD_PREVIOUS_VERSION="$PREVIOUS_RELEASE_VERSION" \
  HERO_RECORD_PREVIOUS_COMMIT="$PREVIOUS_SOURCE_COMMIT" HERO_RECORD_PREVIOUS_DIGEST="$PREVIOUS_IMAGE_DIGEST" \
  HERO_RECORD_BACKUP="$backup" release_json_write_record "$target" || fail "Could not write release state metadata."
}

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

restore_previous() {
  update_env "$PREVIOUS_IMAGE" "$PREVIOUS_RELEASE_VERSION" "$PREVIOUS_SOURCE_COMMIT" "$PREVIOUS_IMAGE_DIGEST"
  docker compose --project-name "$PROJECT_NAME" --env-file "$ENV_FILE" --profile postgres up -d --no-deps --no-build --force-recreate control-plane >/dev/null 2>&1 || true
}

on_exit() {
  local status=$?
  trap - EXIT
  if (( PROMOTION_ACTIVE == 1 && status != 0 )); then
    set +e
    note "promotion failed; attempting automatic rollback"
    restore_previous
    write_record "$STATE_FILE" "auto-rolled-back" "$PREVIOUS_IMAGE" "$IMAGE_REF" "$BACKUP_FILE" >/dev/null 2>&1 || true
    printf 'ERROR: automatic rollback was attempted; inspect %s\n' "$STATE_FILE" >&2
  fi
  exit "$status"
}
trap on_exit EXIT

cd "$PROJECT_ROOT"
docker compose --project-name "$PROJECT_NAME" --env-file "$ENV_FILE" --profile postgres config --quiet
note "verifying the previous immutable image is still available for rollback"
docker pull "$PREVIOUS_IMAGE"
note "pulling immutable candidate before changing Test"
docker pull "$IMAGE_REF"
BACKUP_FILE="${STATE_FILE}.before-${IMAGE_REF##*@sha256:}.json"
write_record "$BACKUP_FILE" "prepared" "$PREVIOUS_IMAGE" "$PREVIOUS_IMAGE" "$BACKUP_FILE"
update_env "$IMAGE_REF" "$RELEASE_VERSION" "$SOURCE_COMMIT" "$IMAGE_REF"
PROMOTION_ACTIVE=1
docker compose --project-name "$PROJECT_NAME" --env-file "$ENV_FILE" --profile postgres up -d --no-deps --no-build --force-recreate control-plane
for attempt in $(seq 1 30); do
  if curl --fail --silent --show-error --max-time 3 http://127.0.0.1:43101/ready >/dev/null; then break; fi
  [[ "$attempt" -eq 30 ]] && fail "Hero Test did not become ready; automatic rollback will run."
  sleep 2
done
ACTUAL_IMAGE="$(docker inspect hero-test-control-plane-1 --format '{{.Config.Image}}')"
[[ "$ACTUAL_IMAGE" == "$IMAGE_REF" ]] || fail "Container image does not match the requested immutable artifact."
BUILD_INFO="$(curl --fail --silent --show-error --max-time 5 http://127.0.0.1:43101/build-info)"
[[ "$(release_json_get_text "$BUILD_INFO" imageDigest)" == "$IMAGE_REF" ]] || fail "Build info image digest does not match the requested artifact."
[[ "$(release_json_get_text "$BUILD_INFO" releaseVersion)" == "${RELEASE_VERSION:-}" ]] || fail "Build info release version does not match the requested version."
[[ "$(release_json_get_text "$BUILD_INFO" sourceCommit)" == "${SOURCE_COMMIT:-}" ]] || fail "Build info source commit does not match the requested commit."
for path in /health /ready /workspace?projectId=project-vpn /project-control?projectId=project-vpn; do
  code="$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 5 "http://127.0.0.1:43101${path}")"
  case "$path:$code" in
    /health:200|/ready:200|/workspace\?projectId=project-vpn:401|/project-control\?projectId=project-vpn:401) ;;
    *) fail "Unexpected Test response for $path: HTTP $code" ;;
  esac
done
write_record "$STATE_FILE" "promoted" "$IMAGE_REF" "$PREVIOUS_IMAGE" "$BACKUP_FILE"
PROMOTION_ACTIVE=0
note "SUCCESS — Test now runs $IMAGE_REF"
note "Metadata-only rollback point: $BACKUP_FILE"
