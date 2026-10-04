#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
RUN_DIR="$ROOT_DIR/.run"

usage() {
  echo "usage: sh scripts/setup.sh <dev|prod> <start|run|stop|restart|status>" >&2
  exit 2
}

environment=${1:-}
action=${2:-}
[ "$#" -eq 2 ] || usage
case "$environment" in dev|prod) ;; *) usage ;; esac
case "$action" in start|run|stop|restart|status) ;; *) usage ;; esac

pid_file="$RUN_DIR/vite-$environment.pid"
log_file="$RUN_DIR/vite-$environment.log"

is_running() {
  [ -f "$pid_file" ] || return 1
  pid=$(cat "$pid_file")
  kill -0 "$pid" 2>/dev/null
}

run_server() {
  cd "$ROOT_DIR"
  if [ "$environment" = dev ]; then
    if command -v pnpm >/dev/null 2>&1; then
      exec pnpm dev -- --host 127.0.0.1
    fi
    exec corepack pnpm dev -- --host 127.0.0.1
  fi
  if command -v pnpm >/dev/null 2>&1; then
    exec pnpm preview -- --host 127.0.0.1
  fi
  exec corepack pnpm preview -- --host 127.0.0.1
}

start_server() {
  mkdir -p "$RUN_DIR"
  if is_running; then
    echo "vite $environment is already running (pid $(cat "$pid_file"))"
    return
  fi
  rm -f "$pid_file"
  (
    run_server >>"$log_file" 2>&1 &
    echo "$!" >"$pid_file"
  )
  echo "vite $environment started (pid $(cat "$pid_file"), log $log_file)"
}

stop_server() {
  if ! is_running; then
    rm -f "$pid_file"
    echo "vite $environment is not running"
    return
  fi
  pid=$(cat "$pid_file")
  kill "$pid"
  rm -f "$pid_file"
  echo "vite $environment stopped"
}

case "$action" in
  start) start_server ;;
  run) run_server ;;
  stop) stop_server ;;
  restart) stop_server; start_server ;;
  status)
    if is_running; then
      echo "vite $environment is running (pid $(cat "$pid_file"))"
    else
      rm -f "$pid_file"
      echo "vite $environment is not running"
      exit 1
    fi
    ;;
esac
