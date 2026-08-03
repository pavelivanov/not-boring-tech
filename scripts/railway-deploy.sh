#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Deploy selected Railway services and wait for each deployment to finish.

Usage:
  npm run deploy:railway -- [options]

Options:
  --services <csv>           Services to deploy (default: api,web)
  --message <text>           Railway deployment message
  --timeout <seconds>        Maximum wait per service (default: 900)
  --poll-interval <seconds>  Seconds between status checks (default: 5)
  --health-url <url>         Override the API health URL
  --health-timeout <seconds> Maximum wait per health check (default: 120)
  --push-env <target>        Push .env.production first: api|web|all|none
  --project <id>             Railway project ID (requires --environment)
  --environment <name|id>    Railway environment name or ID
  --skip-health-check        Do not check public endpoints after deployment
  -h, --help                 Show this help
EOF
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

is_positive_integer() {
  [[ "$1" =~ ^[0-9]+$ ]] && [[ "$1" -gt 0 ]]
}

is_failure_status() {
  case "$1" in
    FAILED | CRASHED | REMOVED | CANCELED | CANCELLED | ABORTED) return 0 ;;
    *) return 1 ;;
  esac
}

railway_with_scope() {
  if [[ -n "$PROJECT" || -n "$ENVIRONMENT" ]]; then
    railway "$@" "${RAILWAY_SCOPE_ARGS[@]}"
  else
    railway "$@"
  fi
}

latest_deployment() {
  railway_with_scope deployment list --service "$1" --limit 1 --json | node -e '
    const fs = require("node:fs");
    const [deployment] = JSON.parse(fs.readFileSync(0, "utf8"));
    const clean = (value) => String(value ?? "").replaceAll("\t", " ");
    process.stdout.write(
      `${clean(deployment?.id)}\t${clean(deployment?.status)}\t${clean(deployment?.createdAt)}`,
    );
  '
}

print_failure_logs() {
  local service="$1"
  local deployment_id="$2"

  echo "[$service] Build logs for $deployment_id:" >&2
  railway_with_scope logs "$deployment_id" --service "$service" --build --lines 150 || true
  echo "[$service] Deployment logs for $deployment_id:" >&2
  railway_with_scope logs "$deployment_id" --service "$service" --deployment --lines 150 || true
}

wait_for_deployment() {
  local service="$1"
  local baseline_id="$2"
  local deadline=$((SECONDS + DEPLOY_TIMEOUT_SECONDS))
  local deployment_id=""
  local previous_status=""

  while ((SECONDS < deadline)); do
    local info latest_id latest_status created_at
    info="$(latest_deployment "$service")"
    IFS=$'\t' read -r latest_id latest_status created_at <<<"$info"

    if [[ -z "$latest_id" || ( -z "$deployment_id" && "$latest_id" == "$baseline_id" ) ]]; then
      sleep "$POLL_INTERVAL_SECONDS"
      continue
    fi

    if [[ -z "$deployment_id" ]]; then
      deployment_id="$latest_id"
      echo "[$service] Tracking $deployment_id (created $created_at)"
    elif [[ "$latest_id" != "$deployment_id" ]]; then
      echo "[$service] A newer deployment appeared ($latest_id); tracking it instead."
      deployment_id="$latest_id"
    fi

    if [[ "$latest_status" != "$previous_status" ]]; then
      echo "[$service] Status: $latest_status"
      previous_status="$latest_status"
    fi

    if [[ "$latest_status" == "SUCCESS" ]]; then
      LAST_DEPLOYMENT_ID="$deployment_id"
      return 0
    fi

    if is_failure_status "$latest_status"; then
      echo "[$service] Deployment ended with $latest_status." >&2
      print_failure_logs "$service" "$deployment_id"
      return 1
    fi

    sleep "$POLL_INTERVAL_SECONDS"
  done

  echo "[$service] Timed out after ${DEPLOY_TIMEOUT_SECONDS}s." >&2
  if [[ -n "$deployment_id" ]]; then
    print_failure_logs "$service" "$deployment_id"
  fi
  return 1
}

resolve_health_url() {
  local service="$1"
  local path="$2"

  railway_with_scope domain --service "$service" --json | node -e '
    const fs = require("node:fs");
    const path = process.argv[1];
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    const raw = data?.domains?.find((domain) => domain.includes("."));
    if (!raw) process.exit(1);
    const base = raw.startsWith("http") ? raw : `https://${raw}`;
    process.stdout.write(`${base.replace(/\/$/, "")}${path}`);
  ' "$path"
}

wait_for_health() {
  local service="$1"
  local url="$2"
  local deadline=$((SECONDS + HEALTH_TIMEOUT_SECONDS))

  echo "[$service] Checking $url"
  while ((SECONDS < deadline)); do
    if curl --fail --silent --show-error --max-time 10 "$url" >/dev/null 2>&1; then
      echo "[$service] Health check passed."
      return 0
    fi
    sleep 2
  done

  echo "[$service] Health check failed after ${HEALTH_TIMEOUT_SECONDS}s: $url" >&2
  return 1
}

SERVICES_CSV="api,web"
MESSAGE=""
DEPLOY_TIMEOUT_SECONDS=900
POLL_INTERVAL_SECONDS=5
HEALTH_TIMEOUT_SECONDS=120
API_HEALTH_URL=""
PUSH_ENV_TARGET="none"
PROJECT=""
ENVIRONMENT=""
SKIP_HEALTH_CHECK=0
LAST_DEPLOYMENT_ID=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --services) SERVICES_CSV="${2:-}"; shift 2 ;;
    --message) MESSAGE="${2:-}"; shift 2 ;;
    --timeout) DEPLOY_TIMEOUT_SECONDS="${2:-}"; shift 2 ;;
    --poll-interval) POLL_INTERVAL_SECONDS="${2:-}"; shift 2 ;;
    --health-url) API_HEALTH_URL="${2:-}"; shift 2 ;;
    --health-timeout) HEALTH_TIMEOUT_SECONDS="${2:-}"; shift 2 ;;
    --push-env) PUSH_ENV_TARGET="${2:-}"; shift 2 ;;
    --project) PROJECT="${2:-}"; shift 2 ;;
    --environment) ENVIRONMENT="${2:-}"; shift 2 ;;
    --skip-health-check) SKIP_HEALTH_CHECK=1; shift ;;
    -h | --help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage; exit 1 ;;
  esac
done

[[ -n "$SERVICES_CSV" ]] || { echo "--services cannot be empty" >&2; exit 1; }
is_positive_integer "$DEPLOY_TIMEOUT_SECONDS" || { echo "--timeout must be a positive integer" >&2; exit 1; }
is_positive_integer "$POLL_INTERVAL_SECONDS" || { echo "--poll-interval must be a positive integer" >&2; exit 1; }
is_positive_integer "$HEALTH_TIMEOUT_SECONDS" || { echo "--health-timeout must be a positive integer" >&2; exit 1; }

case "$PUSH_ENV_TARGET" in
  api | web | all | none) ;;
  *) echo "--push-env must be api, web, all, or none" >&2; exit 1 ;;
esac

if [[ -n "$PROJECT" && -z "$ENVIRONMENT" ]]; then
  echo "--project requires --environment" >&2
  exit 1
fi

require_command railway
require_command node
require_command curl

RAILWAY_SCOPE_ARGS=()
[[ -n "$PROJECT" ]] && RAILWAY_SCOPE_ARGS+=(--project "$PROJECT")
[[ -n "$ENVIRONMENT" ]] && RAILWAY_SCOPE_ARGS+=(--environment "$ENVIRONMENT")

SERVICES=()
IFS=',' read -r -a raw_services <<<"$SERVICES_CSV"
for raw_service in "${raw_services[@]}"; do
  service="${raw_service//[[:space:]]/}"
  [[ -n "$service" ]] && SERVICES+=("$service")
done
[[ "${#SERVICES[@]}" -gt 0 ]] || { echo "No services were selected." >&2; exit 1; }

if [[ -z "$MESSAGE" ]]; then
  revision="$(git rev-parse --short HEAD 2>/dev/null || printf 'working-tree')"
  MESSAGE="Deploy $revision at $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
fi

echo "Railway deployment"
echo "Services: ${SERVICES[*]}"
echo "Message:  $MESSAGE"

railway whoami --json >/dev/null
if [[ -z "$PROJECT" && -z "$ENVIRONMENT" ]]; then
  railway status --json >/dev/null
fi

available_services="$(railway_with_scope service list --json)"
for service in "${SERVICES[@]}"; do
  SERVICE_TO_FIND="$service" node -e '
    const fs = require("node:fs");
    const services = JSON.parse(fs.readFileSync(0, "utf8"));
    if (!services.some((item) => item.name === process.env.SERVICE_TO_FIND || item.id === process.env.SERVICE_TO_FIND)) {
      console.error(`Railway service not found: ${process.env.SERVICE_TO_FIND}`);
      process.exit(1);
    }
  ' <<<"$available_services"
done

if [[ "$PUSH_ENV_TARGET" != "none" ]]; then
  if [[ -n "$PROJECT" || -n "$ENVIRONMENT" ]]; then
    bash scripts/railway-env-push.sh "$PUSH_ENV_TARGET" "${RAILWAY_SCOPE_ARGS[@]}"
  else
    bash scripts/railway-env-push.sh "$PUSH_ENV_TARGET"
  fi
fi

DEPLOYED_SERVICES=()
for service in "${SERVICES[@]}"; do
  baseline="$(latest_deployment "$service")"
  IFS=$'\t' read -r baseline_id _ _ <<<"$baseline"

  echo "[$service] Uploading source..."
  railway_with_scope up --service "$service" --detach --yes --message "$MESSAGE"
  wait_for_deployment "$service" "$baseline_id"
  echo "[$service] Deployment succeeded ($LAST_DEPLOYMENT_ID)."
  DEPLOYED_SERVICES+=("$service")
done

if [[ "$SKIP_HEALTH_CHECK" -eq 0 ]]; then
  for service in "${DEPLOYED_SERVICES[@]}"; do
    case "$service" in
      api)
        url="$API_HEALTH_URL"
        [[ -n "$url" ]] || url="$(resolve_health_url api /health)"
        wait_for_health api "$url"
        ;;
      web)
        url="$(resolve_health_url web /)"
        wait_for_health web "$url"
        ;;
    esac
  done
fi

echo "All requested deployments finished successfully."
