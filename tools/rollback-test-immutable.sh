#!/usr/bin/env bash
# Roll back the last Hero Test promotion using metadata-only state.
set -Eeuo pipefail
readonly PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
readonly PROJECT_NAME="hero-test"
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

STATE_VALUES="$(node --input-type=module - "$STATE_FILE" <<'NODE'
import fs from "node:fs";
const state = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
if (state.schema !== "hero.test-release-state/v1" || state.environment !== "test") process.exit(1);
if (state.status !== "promoted") process.exit(2);
console.log([state.currentImage ?? "", state.previousImage ?? "", state.previousReleaseVersion ?? "", state.previousSourceCommit ?? "", state.previousImageDigest ?? ""].join("\t"));
NODE
)" || fail "The release state is invalid or is not a promotable state."
IFS=$'\t' read -r CURRENT_IMAGE PREVIOUS_IMAGE PREVIOUS_VERSION PREVIOUS_COMMIT PREVIOUS_DIGEST <<< "$STATE_VALUES"
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
  HERO_STATE_VERSION="$PREVIOUS_VERSION" HERO_STATE_COMMIT="$PREVIOUS_COMMIT" node --input-type=module <<'NODE'
import fs from "node:fs";
const target = process.env.HERO_STATE_FILE;
const previous = fs.existsSync(target) ? JSON.parse(fs.readFileSync(target, "utf8")) : {};
const record = {
  ...previous,
  schema: "hero.test-release-state/v1",
  status: "rolled-back",
  environment: "test",
  currentImage: process.env.HERO_STATE_CURRENT,
  previousImage: process.env.HERO_STATE_PREVIOUS,
  releaseVersion: process.env.HERO_STATE_VERSION || null,
  commitSha: process.env.HERO_STATE_COMMIT || null,
  rolledBackAt: new Date().toISOString()
};
const temp = target + ".tmp-" + process.pid + "-" + Math.random().toString(16).slice(2);
const fd = fs.openSync(temp, "wx", 0o600);
try { fs.writeFileSync(fd, JSON.stringify(record, null, 2) + "\n", "utf8"); fs.fsyncSync(fd); }
finally { fs.closeSync(fd); }
fs.renameSync(temp, target);
NODE
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
