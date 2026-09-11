#!/usr/bin/env bash
# Promote one immutable GHCR artifact to Hero Test only.
# This script intentionally never names, stops, recreates or reads Production.
set -euo pipefail

readonly PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly PROJECT_NAME="hero-test"
readonly ENV_FILE="${HERO_TEST_ENV_FILE:-/etc/hero/hero-test.env}"
readonly EXPECTED_PREFIX="ghcr.io/farhaddgm/hero@sha256:"
readonly IMAGE_REF="${1:-}"

fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
note() { printf 'Hero Test promotion: %s\n' "$*"; }

[[ "$IMAGE_REF" =~ ^ghcr\.io/farhaddgm/hero@sha256:[a-f0-9]{64}$ ]] || fail "Pass one immutable Hero image digest, never a tag."
[[ "$IMAGE_REF" == "$EXPECTED_PREFIX"* ]] || fail "Artifact must belong to the Hero GHCR package."
[[ -f "$ENV_FILE" ]] || fail "Test environment file was not found: $ENV_FILE"
[[ "$ENV_FILE" != *production* ]] || fail "Refusing a production-named environment file."

if ! command -v docker >/dev/null 2>&1; then fail "Docker is required on the Hero server."; fi
if ! docker info >/dev/null 2>&1; then fail "Docker access is required; run through sudo or a Docker-enabled account."; fi

cd "$PROJECT_ROOT"
note "validating Compose and isolated Test configuration"
docker compose --project-name "$PROJECT_NAME" --env-file "$ENV_FILE" --profile postgres config --quiet

note "pulling the immutable candidate before changing Test configuration"
docker pull "$IMAGE_REF"

readonly BACKUP_FILE="${ENV_FILE}.hero-test-before-${IMAGE_REF##*@sha256:}.bak"
umask 077
cp -- "$ENV_FILE" "$BACKUP_FILE"
trap 'note "promotion stopped; previous environment file is retained at $BACKUP_FILE"' ERR

TMP_ENV="$(mktemp "${ENV_FILE}.tmp.XXXXXX")"
trap 'rm -f "$TMP_ENV"; note "promotion stopped; previous environment file is retained at $BACKUP_FILE"' ERR
awk -v image="$IMAGE_REF" '
  BEGIN { updated = 0 }
  /^HERO_IMAGE=/ { print "HERO_IMAGE=" image; updated = 1; next }
  { print }
  END { if (!updated) print "HERO_IMAGE=" image }
' "$ENV_FILE" > "$TMP_ENV"
chmod 600 "$TMP_ENV"
mv -f "$TMP_ENV" "$ENV_FILE"

note "recreating only hero-test control-plane (no dependencies)"
docker compose --project-name "$PROJECT_NAME" --env-file "$ENV_FILE" --profile postgres up -d --no-deps --no-build --force-recreate control-plane

for attempt in $(seq 1 30); do
  if curl --fail --silent --show-error --max-time 3 http://127.0.0.1:43101/ready >/dev/null; then
    break
  fi
  [[ "$attempt" -eq 30 ]] && fail "Hero Test did not become ready. Restore $BACKUP_FILE and recreate only control-plane."
  sleep 2
done

ACTUAL_IMAGE="$(docker inspect hero-test-control-plane-1 --format '{{.Config.Image}}')"
[[ "$ACTUAL_IMAGE" == "$IMAGE_REF" ]] || fail "Container image does not match the requested immutable artifact."
for path in /health /ready /workspace?projectId=project-vpn /project-control?projectId=project-vpn; do
  code="$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 5 "http://127.0.0.1:43101${path}")"
  case "$path:$code" in
    /health:200|/ready:200|/workspace\?projectId=project-vpn:401|/project-control\?projectId=project-vpn:401) ;;
    *) fail "Unexpected Test response for $path: HTTP $code" ;;
  esac
done

note "SUCCESS — Test now runs $IMAGE_REF"
note "Backup retained for rollback: $BACKUP_FILE"
