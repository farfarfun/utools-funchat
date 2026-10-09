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
case "$action" in
  start|run|stop|restart) [ "$#" -eq 2 ] || usage ;;
  status) [ "$#" -le 2 ] || usage ;;
  *) usage ;;
esac
case "$environment" in ''|dev|prod) ;; *) usage ;; esac
case "$action" in status) ;; *) [ -n "$environment" ] || usage ;; esac

pid_file="$RUN_DIR/vite-$environment.pid"
log_file="$RUN_DIR/vite-$environment.log"
server_action=dev
if [ "$environment" = prod ]; then
  server_action=preview
fi

inspect_pid_file() {
  pid_state=missing
  pid=
  [ -f "$pid_file" ] || return

  pid=$(cat "$pid_file" 2>/dev/null || true)
  case "$pid" in
    ''|*[!0-9]*) pid_state=stale; return ;;
  esac
  if ! kill -0 "$pid" 2>/dev/null; then
    pid_state=stale
    return
  fi

  command=$(ps -p "$pid" -o args= 2>/dev/null || true)
  case "$command" in
    *pnpm*" $server_action"*) pid_state=running ;;
    *) pid_state=foreign ;;
  esac
}

clear_stale_pid_file() {
  inspect_pid_file
  case "$pid_state" in
    missing) return ;;
    stale)
      echo "vite $environment found stale PID file${pid:+ (pid $pid)}; removing it"
      rm -f "$pid_file"
      ;;
    running)
      echo "vite $environment is already running (pid $pid)" >&2
      return 1
      ;;
    foreign)
      echo "vite $environment PID file points to an unrelated running process (pid $pid); refusing to modify it" >&2
      return 1
      ;;
  esac
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
  clear_stale_pid_file
  (
    run_server >>"$log_file" 2>&1 &
    echo "$!" >"$pid_file"
  )
  echo "vite $environment started (pid $(cat "$pid_file"), log $log_file)"
}

stop_server() {
  inspect_pid_file
  case "$pid_state" in
    running)
      kill "$pid"
      rm -f "$pid_file"
      echo "vite $environment stopped"
      ;;
    stale)
      echo "vite $environment found stale PID file${pid:+ (pid $pid)}; removing it"
      rm -f "$pid_file"
      echo "vite $environment is not running"
      ;;
    missing)
      echo "vite $environment is not running"
      ;;
    foreign)
      echo "vite $environment PID file points to an unrelated running process (pid $pid); refusing to stop it" >&2
      return 1
      ;;
  esac
}

status_server() {
  inspect_pid_file
  case "$pid_state" in
    running)
      echo "vite $environment is running (pid $pid)"
      ;;
    stale)
      echo "vite $environment found stale PID file${pid:+ (pid $pid)}; removing it"
      rm -f "$pid_file"
      echo "vite $environment is not running"
      return 1
      ;;
    missing)
      echo "vite $environment is not running"
      return 1
      ;;
    foreign)
      echo "vite $environment PID file points to an unrelated running process (pid $pid)"
      return 1
      ;;
  esac
}

case "$action" in
  start) start_server ;;
  run) run_server ;;
  stop) stop_server ;;
  restart) stop_server; start_server ;;
  status)
    if [ -n "$environment" ]; then
      status_server
    else
      status=0
      for environment in dev prod; do
        pid_file="$RUN_DIR/vite-$environment.pid"
        log_file="$RUN_DIR/vite-$environment.log"
        server_action=dev
        if [ "$environment" = prod ]; then
          server_action=preview
        fi
        status_server || status=1
      done
      exit "$status"
    fi
    ;;
esac
