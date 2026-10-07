#!/usr/bin/env bash
# Hero Test acceptance (WP-04..WP-14, BO-043..BO-170) on the Test host.
#
# Runs the EXACT immutable candidate image as a disposable instance with its own
# throwaway PostgreSQL, on an internal Docker network with no internet access.
# It never touches the live hero-test containers, volumes, ports or env file,
# never asks for a password and never prints credentials. The instance is
# killed and restarted mid-run to prove durable replay, and everything it
# created is removed at the end (even on failure). Only the redacted check
# results are kept under /var/lib/hero-acceptance.
#
# Usage: sudo bash tools/run-test-acceptance.sh ghcr.io/farhaddgm/hero@sha256:<64-hex>
set -euo pipefail

readonly PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
readonly IMAGE="${1:-}"
readonly POSTGRES_IMAGE="postgres:16.4-alpine"
[[ "$IMAGE" =~ ^ghcr\.io/farhaddgm/hero@sha256:[a-f0-9]{64}$ ]] || { echo "ACCEPTANCE: BLOCKED — pass ghcr.io/farhaddgm/hero@sha256:<64-hex-digest>" >&2; exit 2; }
command -v docker >/dev/null || { echo "ACCEPTANCE: BLOCKED — docker is required." >&2; exit 2; }
[[ -f "$PROJECT_ROOT/tools/acceptance/run-test-acceptance.mjs" ]] || { echo "ACCEPTANCE: BLOCKED — runner missing; update /opt/hero first (git pull)." >&2; exit 2; }

readonly RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$(od -An -N3 -tx1 /dev/urandom | tr -d ' \n')"
readonly NET="hero-acceptance-net-$RUN_ID"
readonly PG="hero-acceptance-pg-$RUN_ID"
readonly APP="hero-acceptance-app-$RUN_ID"
readonly WORK="$(mktemp -d /tmp/hero-acceptance.XXXXXXXX)"
readonly EVIDENCE_DIR="/var/lib/hero-acceptance"
chmod 700 "$WORK"
mkdir -p "$WORK/state"

cleanup() {
  docker rm -f "$APP" "$PG" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

random_hex() { od -An -N"$1" -tx1 /dev/urandom | tr -d ' \n'; }
random_base32() { local out=""; while ((${#out} < $1)); do out+="$(head -c 256 /dev/urandom | LC_ALL=C tr -dc 'A-Z2-7')"; done; printf '%s' "${out:0:$1}"; }

# Ephemeral, never-reused credentials for the disposable instance only.
PG_PASSWORD="$(random_hex 24)"
OWNER_PASSWORD="$(random_hex 18)"
OWNER_MFA="$(random_base32 32)"
SESSION_SECRET="$(random_hex 32)"
umask 077
cat > "$WORK/app.env" <<EOF
HERO_POSTGRES_URL=postgresql://hero:${PG_PASSWORD}@${PG}:5432/hero
HERO_REQUIRE_POSTGRES=true
HERO_IDENTITY_SESSION_SECRET=${SESSION_SECRET}
HERO_OWNER_EMAIL=owner@acceptance.invalid
HERO_OWNER_PASSWORD=${OWNER_PASSWORD}
HERO_OWNER_MFA_SECRET=${OWNER_MFA}
HERO_IMAGE_DIGEST=${IMAGE}
HERO_ENABLE_REAL_PROVIDERS=false
EOF
cat > "$WORK/runner.env" <<EOF
HERO_ACCEPTANCE_BASE_URL=http://${APP}:3100
HERO_ACCEPTANCE_STATE_DIR=/state
HERO_OWNER_EMAIL=owner@acceptance.invalid
HERO_OWNER_PASSWORD=${OWNER_PASSWORD}
HERO_OWNER_MFA_SECRET=${OWNER_MFA}
EOF
cat > "$WORK/pg.env" <<EOF
POSTGRES_DB=hero
POSTGRES_USER=hero
POSTGRES_PASSWORD=${PG_PASSWORD}
EOF
[[ ${#OWNER_MFA} -eq 32 && ${#PG_PASSWORD} -eq 48 && ${#SESSION_SECRET} -eq 64 ]] || { echo "ACCEPTANCE: FAILED — could not generate ephemeral credentials." >&2; exit 1; }
unset PG_PASSWORD OWNER_PASSWORD OWNER_MFA SESSION_SECRET

echo "Hero acceptance $RUN_ID: preparing a disposable instance of $IMAGE"
docker pull --quiet "$IMAGE" >/dev/null
docker image inspect "$POSTGRES_IMAGE" >/dev/null 2>&1 || docker pull --quiet "$POSTGRES_IMAGE" >/dev/null
# --internal: no route to the internet, so no Provider, GitHub or Notion call is possible.
docker network create --internal --label hero.acceptance="$RUN_ID" "$NET" >/dev/null
docker run -d --name "$PG" --network "$NET" --label hero.acceptance="$RUN_ID" --env-file "$WORK/pg.env" --tmpfs /var/lib/postgresql/data "$POSTGRES_IMAGE" >/dev/null
for _ in $(seq 1 60); do docker exec "$PG" pg_isready -h 127.0.0.1 -U hero -d hero >/dev/null 2>&1 && break; sleep 1; done
docker exec "$PG" pg_isready -h 127.0.0.1 -U hero -d hero >/dev/null 2>&1 || { echo "ACCEPTANCE: FAILED — disposable PostgreSQL did not start." >&2; exit 1; }

start_app() {
  for _ in $(seq 1 60); do
    if docker exec "$APP" node -e "fetch('http://127.0.0.1:3100/ready').then(r=>r.json()).then(b=>process.exit(b.status==='ready'&&b.persistence==='postgresql'?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  echo "ACCEPTANCE: FAILED — disposable Hero instance is not ready." >&2
  docker logs --tail 20 "$APP" 2>&1 | grep -viE 'password|secret|token' >&2 || true
  return 1
}
run_phase() {
  docker run --rm --network "$NET" --user root --label hero.acceptance="$RUN_ID" \
    --env-file "$WORK/runner.env" \
    -v "$PROJECT_ROOT/tools/acceptance:/acceptance:ro" -v "$WORK/state:/state" \
    --entrypoint node "$IMAGE" /acceptance/run-test-acceptance.mjs "$1"
}

docker run -d --name "$APP" --network "$NET" --label hero.acceptance="$RUN_ID" --env-file "$WORK/app.env" "$IMAGE" >/dev/null
start_app
status=0
run_phase seed || status=1
echo "Hero acceptance: killing the instance mid-flight to prove durable replay"
docker kill --signal KILL "$APP" >/dev/null
docker start "$APP" >/dev/null
start_app
run_phase verify || status=1

mkdir -p "$EVIDENCE_DIR"
chmod 755 "$EVIDENCE_DIR"
evidence="$EVIDENCE_DIR/acceptance-$RUN_ID.json"
{
  printf '{"runId":"%s","image":"%s","phases":{"seed":' "$RUN_ID" "$IMAGE"
  cat "$WORK/state/checks-seed.json" 2>/dev/null || printf 'null'
  printf ',"verify":'
  cat "$WORK/state/checks-verify.json" 2>/dev/null || printf 'null'
  printf '}}\n'
} > "$evidence"
chmod 644 "$evidence"
echo "Hero acceptance evidence (no credentials): $evidence"
if [[ $status -eq 0 ]]; then echo "HERO ACCEPTANCE: PASS — BO-043..BO-170 on $IMAGE"; else echo "HERO ACCEPTANCE: FAIL — see FAIL lines above"; fi
exit $status
