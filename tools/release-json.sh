#!/usr/bin/env bash
# Small JSON boundary helpers for the Docker-only Test host.
# The Test server does not need Node.js installed on the host. Prefer jq and
# fall back to Python 3; both paths keep secrets out of output.

release_json_get() {
  local file="$1" key="$2"
  if command -v jq >/dev/null 2>&1; then
    jq -r --arg key "$key" '
      if (type == "object" and has($key) and .[$key] != null)
      then (if (.[$key] | type) == "string" then .[$key] else (.[$key] | tostring) end)
      else ""
      end
    ' "$file"
    return
  fi
  if command -v python3 >/dev/null 2>&1; then
    python3 - "$file" "$key" <<'PY'
import json
import sys

try:
    with open(sys.argv[1], encoding="utf-8") as handle:
        value = json.load(handle).get(sys.argv[2])
except (OSError, ValueError, AttributeError):
    raise SystemExit(1)
if value is None:
    print("")
elif isinstance(value, str):
    print(value)
else:
    print(str(value))
PY
    return
  fi
  return 127
}

release_json_get_text() {
  local text="$1" key="$2"
  if command -v jq >/dev/null 2>&1; then
    jq -r --arg key "$key" '
      if (type == "object" and has($key) and .[$key] != null)
      then (if (.[$key] | type) == "string" then .[$key] else (.[$key] | tostring) end)
      else ""
      end
    ' <<<"$text"
    return
  fi
  if command -v python3 >/dev/null 2>&1; then
    RELEASE_JSON_TEXT="$text" RELEASE_JSON_KEY="$key" python3 - <<'PY'
import json
import os

try:
    value = json.loads(os.environ["RELEASE_JSON_TEXT"]).get(os.environ["RELEASE_JSON_KEY"])
except (ValueError, AttributeError, KeyError):
    raise SystemExit(1)
if value is None:
    print("")
elif isinstance(value, str):
    print(value)
else:
    print(str(value))
PY
    return
  fi
  return 127
}

release_json_require_parser() {
  if command -v jq >/dev/null 2>&1 || command -v python3 >/dev/null 2>&1; then return 0; fi
  printf '%s\n' 'Neither jq nor python3 is installed; cannot validate release metadata safely.' >&2
  return 1
}

release_json_validate_manifest() {
  local file="$1" schema contract environment version commit artifact created release_url workflow_run_id
  [[ -f "$file" && ! -L "$file" ]] || { printf 'Manifest must be a regular non-symlink file: %s\n' "$file" >&2; return 1; }
  release_json_require_parser || return 1
  schema="$(release_json_get "$file" schema)" || return 1
  contract="$(release_json_get "$file" contractVersion)" || return 1
  environment="$(release_json_get "$file" environment)" || return 1
  version="$(release_json_get "$file" releaseVersion)" || return 1
  commit="$(release_json_get "$file" commitSha)" || return 1
  artifact="$(release_json_get "$file" artifact)" || return 1
  created="$(release_json_get "$file" createdAt)" || return 1
  release_url="$(release_json_get "$file" releaseUrl)" || return 1
  workflow_run_id="$(release_json_get "$file" workflowRunId)" || return 1
  [[ "$schema" == 'hero.release-manifest/v1' ]] || { printf '%s\n' 'Manifest schema is invalid.' >&2; return 1; }
  [[ "$contract" == '1.0' ]] || { printf '%s\n' 'Manifest contract version is invalid.' >&2; return 1; }
  [[ "$environment" == 'test' ]] || { printf '%s\n' 'Only the Test environment is allowed by this manifest.' >&2; return 1; }
  [[ "$version" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$ ]] || { printf '%s\n' 'Manifest releaseVersion is invalid.' >&2; return 1; }
  [[ "$commit" =~ ^[0-9a-fA-F]{7,64}$ ]] || { printf '%s\n' 'Manifest commitSha is invalid.' >&2; return 1; }
  [[ "$artifact" =~ ^ghcr\.io/farhaddgm/hero@sha256:[a-f0-9]{64}$ ]] || { printf '%s\n' 'Manifest artifact is not an immutable Hero GHCR digest.' >&2; return 1; }
  [[ -n "$created" ]] || { printf '%s\n' 'Manifest createdAt is missing.' >&2; return 1; }
  if [[ -n "$release_url" && ! "$release_url" =~ ^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/releases/tag/v[^[:space:]]+$ ]]; then
    printf '%s\n' 'Manifest releaseUrl is invalid.' >&2
    return 1
  fi
  if [[ -n "$workflow_run_id" && ! "$workflow_run_id" =~ ^[0-9]+$ ]]; then
    printf '%s\n' 'Manifest workflowRunId is invalid.' >&2
    return 1
  fi
}

release_json_write_record() {
  local target="$1"
  release_json_require_parser || return 1
  local temp="${target}.tmp-$$-${RANDOM}"
  umask 077
  if command -v python3 >/dev/null 2>&1; then
    TARGET="$temp" python3 - <<'PY'
import json
import os

record = {
    "schema": "hero.test-release-state/v1",
    "status": os.environ.get("HERO_RECORD_STATUS") or None,
    "environment": "test",
    "releaseVersion": os.environ.get("HERO_RECORD_VERSION") or None,
    "commitSha": os.environ.get("HERO_RECORD_COMMIT") or None,
    "releaseUrl": os.environ.get("HERO_RECORD_RELEASE_URL") or None,
    "currentImage": os.environ.get("HERO_RECORD_CURRENT") or None,
    "previousImage": os.environ.get("HERO_RECORD_PREVIOUS") or None,
    "previousReleaseVersion": os.environ.get("HERO_RECORD_PREVIOUS_VERSION") or None,
    "previousSourceCommit": os.environ.get("HERO_RECORD_PREVIOUS_COMMIT") or None,
    "previousImageDigest": os.environ.get("HERO_RECORD_PREVIOUS_DIGEST") or None,
    "metadataOnlyBackup": os.environ.get("HERO_RECORD_BACKUP") or None,
    "recordedAt": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat().replace("+00:00", "Z"),
}
with open(os.environ["TARGET"], "x", encoding="utf-8") as handle:
    json.dump(record, handle, ensure_ascii=False, indent=2)
    handle.write("\n")
    handle.flush()
    os.fsync(handle.fileno())
PY
  else
    jq -n \
      --arg status "${HERO_RECORD_STATUS:-}" \
      --arg version "${HERO_RECORD_VERSION:-}" \
      --arg commit "${HERO_RECORD_COMMIT:-}" \
      --arg url "${HERO_RECORD_RELEASE_URL:-}" \
      --arg current "${HERO_RECORD_CURRENT:-}" \
      --arg previous "${HERO_RECORD_PREVIOUS:-}" \
      --arg previousVersion "${HERO_RECORD_PREVIOUS_VERSION:-}" \
      --arg previousCommit "${HERO_RECORD_PREVIOUS_COMMIT:-}" \
      --arg previousDigest "${HERO_RECORD_PREVIOUS_DIGEST:-}" \
      --arg backup "${HERO_RECORD_BACKUP:-}" \
      '{schema:"hero.test-release-state/v1",status:(if $status == "" then null else $status end),environment:"test",releaseVersion:(if $version == "" then null else $version end),commitSha:(if $commit == "" then null else $commit end),releaseUrl:(if $url == "" then null else $url end),currentImage:(if $current == "" then null else $current end),previousImage:(if $previous == "" then null else $previous end),previousReleaseVersion:(if $previousVersion == "" then null else $previousVersion end),previousSourceCommit:(if $previousCommit == "" then null else $previousCommit end),previousImageDigest:(if $previousDigest == "" then null else $previousDigest end),metadataOnlyBackup:(if $backup == "" then null else $backup end),recordedAt:(now|todateiso8601)}' > "$temp"
    chmod 600 "$temp"
    sync -d "$temp" 2>/dev/null || true
  fi
  chmod 600 "$temp"
  mv -f -- "$temp" "$target"
  return 0
}

release_json_write_rollback_state() {
  local target="$1"
  release_json_require_parser || return 1
  local temp="${target}.tmp-$$-${RANDOM}"
  umask 077
  if command -v python3 >/dev/null 2>&1; then
    TARGET="$temp" SOURCE="$target" python3 - <<'PY'
import json
import os
from datetime import datetime, timezone

with open(os.environ["SOURCE"], encoding="utf-8") as handle:
    record = json.load(handle)
record.update({
    "schema": "hero.test-release-state/v1",
    "status": "rolled-back",
    "environment": "test",
    "currentImage": os.environ.get("HERO_STATE_CURRENT") or None,
    "previousImage": os.environ.get("HERO_STATE_PREVIOUS") or None,
    "releaseVersion": os.environ.get("HERO_STATE_VERSION") or None,
    "commitSha": os.environ.get("HERO_STATE_COMMIT") or None,
    "rolledBackAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
})
with open(os.environ["TARGET"], "x", encoding="utf-8") as handle:
    json.dump(record, handle, ensure_ascii=False, indent=2)
    handle.write("\n")
    handle.flush()
    os.fsync(handle.fileno())
PY
  else
    jq --arg current "${HERO_STATE_CURRENT:-}" --arg previous "${HERO_STATE_PREVIOUS:-}" \
      --arg version "${HERO_STATE_VERSION:-}" --arg commit "${HERO_STATE_COMMIT:-}" \
      '. + {schema:"hero.test-release-state/v1",status:"rolled-back",environment:"test",currentImage:$current,previousImage:$previous,releaseVersion:(if $version == "" then null else $version end),commitSha:(if $commit == "" then null else $commit end),rolledBackAt:(now|todateiso8601)}' "$target" > "$temp"
  fi
  chmod 600 "$temp"
  sync -d "$temp" 2>/dev/null || true
  mv -f -- "$temp" "$target"
}
