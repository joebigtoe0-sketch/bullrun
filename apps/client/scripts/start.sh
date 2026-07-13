#!/bin/sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLIENT_DIR="$(dirname "$SCRIPT_DIR")"
DIST="$CLIENT_DIR/dist"

API="${API_URL:-${VITE_API_URL:-http://localhost:3001}}"
WS="${WS_URL:-${VITE_WS_URL:-$API}}"
SOLANA="${SOLANA_RPC:-${VITE_SOLANA_RPC:-https://api.mainnet-beta.solana.com}}"

API=$(echo "$API" | sed 's:/*$::')
WS=$(echo "$WS" | sed 's:/*$::')
SOLANA=$(echo "$SOLANA" | sed 's:/*$::')

mkdir -p "$DIST"

printf '{"apiUrl":"%s","wsUrl":"%s","solanaRpc":"%s"}\n' "$API" "$WS" "$SOLANA" > "$DIST/config.json"

# Inline config survives SPA fallback when /config.json is not served as a static file
if [ -f "$DIST/index.html" ]; then
  node "$SCRIPT_DIR/inject-config.mjs" "$DIST/index.html" "$API" "$WS" "$SOLANA"
fi

echo "Bull Race client config: api=$API ws=$WS solana=$SOLANA"

cd "$CLIENT_DIR"
PORT="${PORT:-4173}"
exec pnpm exec vite preview --host 0.0.0.0 --port "$PORT"
