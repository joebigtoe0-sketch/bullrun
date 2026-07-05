#!/bin/sh
set -e

DIST="apps/client/dist"
API="${API_URL:-${VITE_API_URL:-http://localhost:3001}}"
WS="${WS_URL:-${VITE_WS_URL:-$API}}"

# Strip trailing slashes
API=$(echo "$API" | sed 's:/*$::')
WS=$(echo "$WS" | sed 's:/*$::')

printf '{"apiUrl":"%s","wsUrl":"%s"}\n' "$API" "$WS" > "$DIST/config.json"
echo "Bull Run client config: api=$API ws=$WS"

exec pnpm --filter @bullrun/client start
