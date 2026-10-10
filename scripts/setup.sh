#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
RUN_DIR="$ROOT_DIR/.run"

usage() {
  echo "usage: sh scripts/setup.sh <start|run|stop|restart> <dev|prod>" >&2
  echo "       sh scripts/setup.sh status [dev|prod]" >&2
  exit 2
}

action=${1:-}
environment=${2:-}
case "$action" in start|run|stop|restart) [ "$#" -eq 2 ] || usage ;; status) [ "$#" -le 2 ] || usage ;; *) usage ;; esac
if [ -n "$environment" ]; then case "$environment" in dev|prod) ;; *) usage ;; esac; fi

set_paths() { pid_file="$RUN_DIR/vite-$1.pid"; log_file="$RUN_DIR/vite-$1.log"; }
if [ -n "$environment" ]; then set_paths "$environment"; fi

is_running() {
  [ -f "$pid_file" ] || return 1
  pid=$(cat "$pid_file")
  case "$pid" in ''|*[!0-9]*) return 1 ;; esac
  kill -0 "$pid" 2>/dev/null || return 1
  command=$(ps -p "$pid" -o command= 2>/dev/null || true)
  case "$command" in *vite*) return 0 ;; *) return 1 ;; esac
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
  if [ -f "$pid_file" ]; then echo "vite $environment stale PID file removed: $pid_file" >&2; rm -f "$pid_file"; fi
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
    if [ -z "$environment" ]; then
      status=0
      for environment in dev prod; do set_paths "$environment"; is_running && echo "vite $environment is running (pid $(cat "$pid_file"))" || { echo "vite $environment is not running"; status=1; }; done
      exit "$status"
    fi
    if is_running; then
      echo "vite $environment is running (pid $(cat "$pid_file"))"
    else
      rm -f "$pid_file"
      echo "vite $environment is not running"
      exit 1
    fi
    ;;
esac
