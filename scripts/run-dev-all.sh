#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/docker-compose.dev.yml"
ZKLOGIN_COMPOSE_FILE="${ROOT_DIR}/docker-compose.zklogin.yml"
ZKLOGIN_ZKEY_PATH="${ZKLOGIN_ZKEY_PATH:-${ROOT_DIR}/.zklogin/zklogin-ceremony-contributions/zkLogin-main.zkey}"
ZKLOGIN_PROVER_PORT="${ZKLOGIN_PROVER_PORT:-9000}"

POSTGRES_DB="${POSTGRES_DB:-celeris}"
POSTGRES_USER="${POSTGRES_USER:-celeris}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-celeris}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"

export POSTGRES_DB
export POSTGRES_USER
export POSTGRES_PASSWORD
export POSTGRES_PORT
export ZKLOGIN_ZKEY_PATH
export ZKLOGIN_PROVER_PORT
export DATABASE_URL="${DATABASE_URL:-postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:${POSTGRES_PORT}/${POSTGRES_DB}?schema=public}"

kill_processes_by_port() {
  local port="$1"
  local label="$2"
  local pids

  pids="$(lsof -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true)"

  if [ -z "${pids}" ]; then
    return 0
  fi

  echo "Stopping previous ${label} process(es) on port ${port}: ${pids}"
  kill ${pids} >/dev/null 2>&1 || true
  sleep 2

  pids="$(lsof -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -n "${pids}" ]; then
    echo "Force stopping ${label} process(es) on port ${port}: ${pids}"
    kill -9 ${pids} >/dev/null 2>&1 || true
  fi
}

kill_processes_by_pattern() {
  local pattern="$1"
  local label="$2"
  local pids

  pids="$(pgrep -f "${pattern}" || true)"

  if [ -z "${pids}" ]; then
    return 0
  fi

  echo "Stopping previous ${label} process(es): ${pids}"
  kill ${pids} >/dev/null 2>&1 || true
  sleep 2

  pids="$(pgrep -f "${pattern}" || true)"
  if [ -n "${pids}" ]; then
    echo "Force stopping ${label} process(es): ${pids}"
    kill -9 ${pids} >/dev/null 2>&1 || true
  fi
}

stop_previous_deployments() {
  echo "Cleaning up previous local deployments..."

  docker compose -f "${COMPOSE_FILE}" down --remove-orphans >/dev/null 2>&1 || true
  docker compose -f "${ZKLOGIN_COMPOSE_FILE}" down --remove-orphans >/dev/null 2>&1 || true
  kill_processes_by_port "${API_PORT:-4100}" "API"
  kill_processes_by_port "${WEB_PORT:-3101}" "web"
  kill_processes_by_port "${ZKLOGIN_PROVER_PORT}" "zkLogin prover"
  kill_processes_by_pattern "cloudflared --no-autoupdate tunnel run --token" "cloudflared tunnel"
}

cleanup() {
  local exit_code="$?"

  if [ "${KEEP_DEV_DB_RUNNING:-0}" != "1" ]; then
    docker compose -f "${COMPOSE_FILE}" down --remove-orphans >/dev/null 2>&1 || true
  fi

  if [ "${KEEP_ZKLOGIN_PROVER_RUNNING:-0}" != "1" ]; then
    docker compose -f "${ZKLOGIN_COMPOSE_FILE}" down --remove-orphans >/dev/null 2>&1 || true
  fi

  exit "${exit_code}"
}

trap cleanup EXIT INT TERM

stop_previous_deployments

echo "Starting local Postgres container on port ${POSTGRES_PORT}..."
docker compose -f "${COMPOSE_FILE}" up -d postgres

if [ ! -f "${ZKLOGIN_ZKEY_PATH}" ]; then
  cat >&2 <<EOF
Missing zkLogin zkey at ${ZKLOGIN_ZKEY_PATH}.

Download the Mainnet/Testnet zkey before running dev:all:
  mkdir -p .zklogin
  cd .zklogin
  wget -O download-main-zkey.sh https://raw.githubusercontent.com/sui-foundation/zklogin-ceremony-contributions/main/download-main-zkey.sh
  bash download-main-zkey.sh
EOF
  exit 1
fi

echo "Starting zkLogin prover on port ${ZKLOGIN_PROVER_PORT}..."
docker compose -f "${ZKLOGIN_COMPOSE_FILE}" up -d

echo "Waiting for Postgres health check..."
for _ in $(seq 1 40); do
  status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' celeris-dev-postgres 2>/dev/null || true)"

  if [ "${status}" = "healthy" ]; then
    break
  fi

  sleep 2
done

status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' celeris-dev-postgres 2>/dev/null || true)"

if [ "${status}" != "healthy" ]; then
  echo "Postgres did not become healthy. Current status: ${status:-unknown}" >&2
  docker compose -f "${COMPOSE_FILE}" logs postgres >&2 || true
  exit 1
fi

echo "Waiting for zkLogin prover health check..."
for _ in $(seq 1 40); do
  if curl -fsS "http://localhost:${ZKLOGIN_PROVER_PORT}/ping" >/dev/null 2>&1; then
    break
  fi

  sleep 2
done

if ! curl -fsS "http://localhost:${ZKLOGIN_PROVER_PORT}/ping" >/dev/null 2>&1; then
  echo "zkLogin prover did not become healthy on port ${ZKLOGIN_PROVER_PORT}." >&2
  docker compose -f "${ZKLOGIN_COMPOSE_FILE}" logs >&2 || true
  exit 1
fi

echo "Running Prisma generate..."
npm run prisma:generate

echo "Applying checked-in Prisma migrations..."
npx prisma migrate deploy --schema packages/db/prisma/schema.prisma

if [ "${DEV_ALL_SKIP_APP_START:-0}" = "1" ]; then
  echo "Skipping app startup because DEV_ALL_SKIP_APP_START=1."
  exit 0
fi

echo "Starting API, web, and Cloudflare tunnel..."
exec npm run dev
