#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
OUTPUT_DIR="$ROOT_DIR/utool"
cd "$ROOT_DIR"

command -v node >/dev/null || { echo "error: Node.js is required" >&2; exit 1; }
command -v pnpm >/dev/null || { echo "error: pnpm is required (corepack enable)" >&2; exit 1; }

echo "=== install dependencies ==="
pnpm install --frozen-lockfile

echo "=== test source ==="
pnpm test
node --check src/preload.js
node -e "JSON.parse(require('fs').readFileSync('plugin.json', 'utf8'))"

echo "=== build Vue application ==="
pnpm build

rm -rf -- "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR/src"
cp -R app logo.png plugin.json "$OUTPUT_DIR/"
cp src/preload.js "$OUTPUT_DIR/src/preload.js"

test -f "$OUTPUT_DIR/app/index.html"
test -f "$OUTPUT_DIR/src/preload.js"
echo "uTools plugin ready: $OUTPUT_DIR/plugin.json"
