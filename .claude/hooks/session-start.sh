#!/bin/bash
# Hero SessionStart hook for Claude Code on the web.
# Prepares the disposable cloud sandbox so `pnpm check` and
# `pnpm check:postgres` work without manual steps. It never runs on a
# developer machine or in CI, and it never touches secrets or remote hosts.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"

log() { echo "[hero-session-start] $*" >&2; }

# 1. Locked Node dependencies (cached with the container image).
pnpm install --frozen-lockfile >&2

# 2. Docker daemon (the sandbox ships dockerd but does not start it).
if command -v dockerd >/dev/null 2>&1; then
  if ! docker info >/dev/null 2>&1; then
    setsid nohup dockerd >/var/log/hero-dockerd.log 2>&1 < /dev/null &
    for _ in $(seq 1 30); do docker info >/dev/null 2>&1 && break; sleep 1; done
  fi
  docker info >/dev/null 2>&1 && log "docker: ready" || log "WARN docker: daemon did not start (see /var/log/hero-dockerd.log)"
else
  log "WARN docker: dockerd is not installed in this sandbox"
fi

# 3. Local PostgreSQL matching CI (database and user "hero", trust auth,
#    loopback only). Connect with HERO_POSTGRES_URL=postgresql://hero@127.0.0.1:5432/hero
HERO_PG_PORT=5432
HERO_PG_ROOT=/var/lib/hero-postgres
HERO_PG_DATA="$HERO_PG_ROOT/data"
HERO_PG_BIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -n 1 || true)"

if [ -z "$HERO_PG_BIN" ]; then
  log "WARN postgres: server binaries are not installed in this sandbox"
elif pg_isready -q -h 127.0.0.1 -p "$HERO_PG_PORT"; then
  log "postgres: already running on 127.0.0.1:$HERO_PG_PORT"
else
  id postgres >/dev/null 2>&1 || useradd --system --no-create-home postgres
  mkdir -p "$HERO_PG_DATA"
  chown -R postgres "$HERO_PG_ROOT"
  chmod 700 "$HERO_PG_DATA"
  if [ ! -f "$HERO_PG_DATA/PG_VERSION" ]; then
    su postgres -s /bin/sh -c "'$HERO_PG_BIN/initdb' -D '$HERO_PG_DATA' -U hero --auth=trust" >/dev/null
  fi
  if su postgres -s /bin/sh -c "'$HERO_PG_BIN/pg_ctl' -D '$HERO_PG_DATA' -l '$HERO_PG_ROOT/server.log' -w -t 30 \
      -o '-p $HERO_PG_PORT -k /tmp -c listen_addresses=127.0.0.1' start" >/dev/null; then
    psql -h 127.0.0.1 -p "$HERO_PG_PORT" -U hero -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'hero'" | grep -q 1 \
      || psql -h 127.0.0.1 -p "$HERO_PG_PORT" -U hero -d postgres -qc "CREATE DATABASE hero"
    log "postgres: ready on 127.0.0.1:$HERO_PG_PORT"
  else
    log "WARN postgres: server did not start (see $HERO_PG_ROOT/server.log)"
  fi
fi
