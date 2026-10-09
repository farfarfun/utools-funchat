#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PLUGIN_DIR="$ROOT_DIR/utools"
cd "$ROOT_DIR"

command -v node >/dev/null || { echo "error: Node.js is required" >&2; exit 1; }
command -v pnpm >/dev/null || { echo "error: pnpm is required, run: corepack enable" >&2; exit 1; }

# 版本只卡下限，不卡死某一个版本：本机已有的新 pnpm 可以直接用，不必为本项目再装一个。
# 但低于 12 必须拦住——lockfile 用的是 pnpm 12 的多文档格式，旧版本读不了；
# pnpm-workspace.yaml 里的 allowBuilds 也是 12 才认的键名，旧版本会静默跳过 esbuild 的构建。
PNPM_VERSION=$(pnpm --version)
PNPM_MAJOR=${PNPM_VERSION%%.*}
if ! [ "$PNPM_MAJOR" -ge 12 ] 2>/dev/null; then
  echo "error: pnpm >= 12 is required, found $PNPM_VERSION" >&2
  echo "       run: corepack enable  (then pnpm follows package.json#packageManager)" >&2
  exit 1
fi

pnpm install --frozen-lockfile
pnpm test
node --check "$PLUGIN_DIR/preload.js"
node -e "JSON.parse(require('fs').readFileSync('$PLUGIN_DIR/plugin.json', 'utf8'))"
rm -rf -- "$PLUGIN_DIR/dist"
pnpm build
test -f "$PLUGIN_DIR/dist/index.html"
test -f "$PLUGIN_DIR/preload.js"
test -f "$PLUGIN_DIR/logo.png"
test ! -e "$PLUGIN_DIR/.git"
echo "uTools plugin ready: $PLUGIN_DIR/plugin.json"
