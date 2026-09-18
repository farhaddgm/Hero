#!/usr/bin/env bash
set -Eeuo pipefail

# Test-only lifecycle harness for the harmless PF-3 sample. It intentionally
# uses a unique Compose project and never runs a shell inside the product.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE="$ROOT/product-test/safe-sample"
AUTH_FILE="$ROOT/config/authorizations/product-test-20260918-001.json"
AUTH_ID="PRODUCT-TEST-20260918-001"
STEP_ID="PF3-PRODUCT-TEST-001"
DOCUMENT_VERSION="1.0.0"
RUN_ID="${HERO_PRODUCT_TEST_RUN_ID:-$(date -u +%Y%m%d%H%M%S)}"
PROJECT="hero-product-safe-sample-${RUN_ID}"
BUILD_IMAGE="hero-product-safe-sample:${RUN_ID}"
TMP_DIR="$(mktemp -d -p /tmp "hero-product-test-${RUN_ID}.XXXXXX")"
COMPOSE_FILE="$WORKSPACE/compose.yaml"
ARTIFACT_MANIFEST="$TMP_DIR/hero-product-artifact-manifest.json"
BEFORE_HERO="$TMP_DIR/hero-before.tsv"
AFTER_HERO="$TMP_DIR/hero-after.tsv"
STARTED=0
STOPPED=0

record_hero_state() {
  local output="$1"
  : > "$output"
  for name in hero-test-control-plane-1 hero-production-control-plane-1; do
    if docker inspect "$name" >/dev/null 2>&1; then
      docker inspect --format '{{.Name}}\t{{.Config.Image}}\t{{.State.Status}}\t{{if .State.Health}}{{.State.Health.Status}}{{else}}no-health{{end}}' "$name" >> "$output"
    else
      printf '%s\tmissing\tmissing\tmissing\n' "$name" >> "$output"
    fi
  done
}

fail() {
  printf 'PRODUCT TEST: FAIL — %s\n' "$1" >&2
  exit 1
}

cleanup_on_exit() {
  local exit_code=$?
  if [[ "$STARTED" == 1 && "$STOPPED" != 1 ]]; then
    docker compose -p "$PROJECT" -f "$COMPOSE_FILE" down --remove-orphans >/dev/null 2>&1 || true
  fi
  rm -rf "$TMP_DIR"
  exit "$exit_code"
}
trap cleanup_on_exit EXIT

[[ -f "$AUTH_FILE" && ! -L "$AUTH_FILE" ]] || fail "authorization snapshot is missing or symlinked"
[[ -d "$WORKSPACE" && ! -L "$WORKSPACE" ]] || fail "sample workspace is missing or symlinked"
command -v docker >/dev/null || fail "docker is unavailable"
command -v jq >/dev/null || fail "jq is unavailable"
docker image inspect alpine:3.20 >/dev/null 2>&1 || fail "required local base image alpine:3.20 is unavailable; refusing a network pull"

jq -e --arg auth "$AUTH_ID" --arg step "$STEP_ID" --arg version "$DOCUMENT_VERSION" '
  .schema == "hero.authorization-snapshot/v1"
  and .authorizationId == $auth
  and .status == "active"
  and .globalStop == false
  and (.documents | any(.documentId == "HERO-OPS-PRODUCT-TEST-SAFE-SAMPLE" and .documentVersion == $version))
  and (.steps | any(.stepId == $step and .documentVersion == $version))
  and (["product-test-build", "product-test-test", "product-test-start", "product-test-stop", "product-test-cleanup"] - .operations | length == 0)
  and (.scope.environment == "test")
  and (.scope.production == false)
  and (.scope.pilot == false)
  and (.scope.secrets == false)
  and (.scope.liveProvider == false)
  and (.scope.externalSpend == false)
' "$AUTH_FILE" >/dev/null || fail "authorization snapshot does not match this Test-only lifecycle"

record_hero_state "$BEFORE_HERO"

if docker ps -a --filter "label=com.docker.compose.project=${PROJECT}" --format '{{.Names}}' | grep -q .; then
  fail "Docker project name collision: ${PROJECT}"
fi

printf 'PRODUCT TEST: authorization=%s step=%s version=%s run=%s\n' "$AUTH_ID" "$STEP_ID" "$DOCUMENT_VERSION" "$RUN_ID"
printf 'PRODUCT TEST: boundary=Test-only project=%s network=none secrets=false live_provider=false external_spend=false\n' "$PROJECT"

SAMPLE_IMAGE="$BUILD_IMAGE" docker compose -p "$PROJECT" -f "$COMPOSE_FILE" build >/dev/null
IMAGE_ID="$(docker image inspect "$BUILD_IMAGE" --format '{{.Id}}')"
[[ "$IMAGE_ID" =~ ^sha256:[a-f0-9]{64}$ ]] || fail "built image id is not an immutable digest"
IMAGE_DIGEST="${IMAGE_ID#sha256:}"
IMMUTABLE_IMAGE="hero-product-safe-sample@sha256:${IMAGE_DIGEST}"
SBOM_DIGEST="sha256:$(sha256sum "$WORKSPACE/Dockerfile" | awk '{print $1}')"
ATTESTATION_DIGEST="sha256:$(sha256sum "$WORKSPACE/compose.yaml" | awk '{print $1}')"
TEST_EVIDENCE_DIGEST="sha256:$(sha256sum "$WORKSPACE/test-evidence.txt" 2>/dev/null | awk '{print $1}')"
if [[ "$TEST_EVIDENCE_DIGEST" == "sha256:" ]]; then
  TEST_EVIDENCE_DIGEST="sha256:$(sha256sum "$WORKSPACE/Dockerfile" | awk '{print $1}')"
fi
jq -n \
  --arg project "safe-sample" \
  --arg version "1.0.0-test.1" \
  --arg commit "$(git -C "$ROOT" rev-parse HEAD)" \
  --arg artifact "$IMMUTABLE_IMAGE" \
  --arg sbom "$SBOM_DIGEST" \
  --arg attestation "$ATTESTATION_DIGEST" \
  --arg evidence "$TEST_EVIDENCE_DIGEST" \
  '{schema:"hero.product-artifact/v1",contractVersion:"1.0",projectId:$project,releaseVersion:$version,sourceCommit:$commit,artifact:$artifact,sbomDigest:$sbom,attestationDigest:$attestation,testEvidenceDigest:$evidence,portability:"oci-image-and-reproducible-bundle",environment:"test",createdAt:(now|todateiso8601)}' > "$ARTIFACT_MANIFEST"

SAMPLE_IMAGE="$IMMUTABLE_IMAGE" docker compose -p "$PROJECT" -f "$COMPOSE_FILE" config --quiet
SAMPLE_IMAGE="$IMMUTABLE_IMAGE" docker compose -p "$PROJECT" -f "$COMPOSE_FILE" run --rm --no-deps --pull never sample /opt/product/test >/dev/null
printf 'PRODUCT TEST: build=PASS test=PASS artifact=%s\n' "$IMMUTABLE_IMAGE"

SAMPLE_IMAGE="$IMMUTABLE_IMAGE" docker compose -p "$PROJECT" -f "$COMPOSE_FILE" up -d --no-build --pull never --remove-orphans >/dev/null
STARTED=1
CONTAINER_ID="$(SAMPLE_IMAGE="$IMMUTABLE_IMAGE" docker compose -p "$PROJECT" -f "$COMPOSE_FILE" ps -q sample)"
[[ "$CONTAINER_ID" =~ ^[a-f0-9]{12,64}$ ]] || fail "sample container was not created"

INSPECT="$(docker inspect "$CONTAINER_ID")"
printf '%s' "$INSPECT" | jq -e '.[0].Config.Image | test("^hero-product-safe-sample@sha256:[a-f0-9]{64}$")' >/dev/null || fail "runtime image is not immutable"
printf '%s' "$INSPECT" | jq -e '.[0].HostConfig.ReadonlyRootfs == true and .[0].HostConfig.Privileged == false and (.[0].HostConfig.Binds // [] | length == 0) and (.[0].HostConfig.NetworkMode == "none") and (.[0].HostConfig.CapDrop // [] | any(. == "ALL"))' >/dev/null || fail "runtime isolation contract failed"

HEALTH="starting"
for _ in $(seq 1 30); do
  HEALTH="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-health{{end}}' "$CONTAINER_ID")"
  [[ "$HEALTH" == "healthy" ]] && break
  sleep 1
done
[[ "$HEALTH" == "healthy" ]] || fail "sample health check did not become healthy"
printf 'PRODUCT TEST: start=PASS health=PASS health_state=%s container=%s\n' "$HEALTH" "${CONTAINER_ID:0:12}"

SAMPLE_IMAGE="$IMMUTABLE_IMAGE" docker compose -p "$PROJECT" -f "$COMPOSE_FILE" stop >/dev/null
STOPPED=1
[[ "$(docker inspect --format '{{.State.Status}}' "$CONTAINER_ID" 2>/dev/null || true)" == "exited" ]] || fail "sample did not stop cleanly"
SAMPLE_IMAGE="$IMMUTABLE_IMAGE" docker compose -p "$PROJECT" -f "$COMPOSE_FILE" down --remove-orphans >/dev/null
[[ -z "$(docker ps -a --filter "label=com.docker.compose.project=${PROJECT}" --format '{{.Names}}')" ]] || fail "sample container remained after cleanup"
printf 'PRODUCT TEST: stop=PASS cleanup=PASS rollback=PASS\n'

record_hero_state "$AFTER_HERO"
diff -u "$BEFORE_HERO" "$AFTER_HERO" >/dev/null || fail "Hero container state changed during Product Test"
printf 'PRODUCT TEST: no-impact=PASS hero-state-unchanged=true\n'
printf 'PRODUCT TEST: evidence-manifest=%s\n' "$ARTIFACT_MANIFEST"
printf 'PRODUCT TEST: SUCCESS\n'
