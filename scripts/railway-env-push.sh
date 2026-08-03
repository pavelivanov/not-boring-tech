#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: bash scripts/railway-env-push.sh <api|web|all> [--project <id> --environment <name|id>]"
}

push_env() {
  local service="$1"
  local file="$2"
  local args=()

  if [[ ! -f "$file" ]]; then
    echo "Environment file not found: $file" >&2
    echo "Create it from the matching .env.example file before using --push-env." >&2
    exit 1
  fi

  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" == \#* ]] && continue
    [[ "$line" == *"="* ]] || { echo "Invalid line in $file (expected KEY=VALUE)." >&2; exit 1; }

    key="${line%%=*}"
    value="${line#*=}"
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || { echo "Invalid variable name in $file: $key" >&2; exit 1; }
    [[ -n "$value" ]] || continue

    value="${value#\"}"
    value="${value%\"}"
    value="${value//\\n/$'\n'}"
    args+=("${key}=${value}")
  done <"$file"

  if [[ "${#args[@]}" -eq 0 ]]; then
    echo "No non-empty variables found in $file" >&2
    exit 1
  fi

  echo "[$service] Pushing ${#args[@]} variables from $file (values hidden)."
  if [[ "$SCOPE_ARG_COUNT" -gt 0 ]]; then
    railway variable set "${args[@]}" --service "$service" --skip-deploys "${SCOPE_ARGS[@]}" >/dev/null
  else
    railway variable set "${args[@]}" --service "$service" --skip-deploys >/dev/null
  fi
}

target="${1:-}"
[[ -n "$target" ]] || { usage; exit 1; }
shift
SCOPE_ARGS=("$@")
SCOPE_ARG_COUNT=$#

case "$target" in
  api) push_env api apps/api/.env.production ;;
  web) push_env web apps/web/.env.production ;;
  all)
    push_env api apps/api/.env.production
    push_env web apps/web/.env.production
    ;;
  *) usage; exit 1 ;;
esac
