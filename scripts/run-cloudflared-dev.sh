#!/usr/bin/env bash

set -euo pipefail

API_PORT="${API_PORT:-4100}"
WEB_PORT="${WEB_PORT:-3101}"
DEVELOPER_APP_ORIGIN="${CELERIS_DEVELOPER_APP_ORIGIN:-https://app.celeris.pro}"
DEMO_FRONTEND_ORIGIN="${CELERIS_DEMO_FRONTEND_ORIGIN:-https://demo.celeris.pro}"
AUTH_ORIGIN="${CELERIS_HOSTED_AUTH_ORIGIN:-https://auth.celeris.pro}"
API_ORIGIN_VALUE="${API_ORIGIN:-https://api.celeris.pro}"

resolve_tunnel_token() {
  if [ -n "${CLOUDFLARED_TUNNEL_TOKEN:-}" ]; then
    printf '%s\n' "${CLOUDFLARED_TUNNEL_TOKEN}"
    return 0
  fi

  if [ -r /etc/init.d/cloudflared ]; then
    sed -n 's/.*--token \([^" ]*\).*/\1/p' /etc/init.d/cloudflared | head -n 1
    return 0
  fi

  return 1
}

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared is not installed or not on PATH." >&2
  exit 1
fi

TUNNEL_TOKEN="$(resolve_tunnel_token || true)"

if [ -z "${TUNNEL_TOKEN}" ]; then
  cat >&2 <<'EOF'
Missing Cloudflare tunnel token.

Set CLOUDFLARED_TUNNEL_TOKEN, or install a local cloudflared service that exposes the token through /etc/init.d/cloudflared.
EOF
  exit 1
fi

cat <<EOF
Starting Cloudflare tunnel for:
  ${DEVELOPER_APP_ORIGIN} -> http://localhost:${WEB_PORT}
  ${DEMO_FRONTEND_ORIGIN} -> http://localhost:${WEB_PORT}
  ${AUTH_ORIGIN} -> http://localhost:${WEB_PORT}
  ${API_ORIGIN_VALUE} -> http://localhost:${API_PORT}
EOF

if [ "${CLOUDFLARED_DRY_RUN:-0}" = "1" ]; then
  exit 0
fi

exec cloudflared --no-autoupdate tunnel run --token "${TUNNEL_TOKEN}"
