#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Push an allowlisted Railway environment file without printing values.

Usage:
  npm run railway:env -- <web|api|parser|digest|all> [options]

Default ignored files:
  .env.railway.web
  .env.railway.api
  .env.railway.parser
  .env.railway.digest

Options:
  --file <path>              Override the file for a single target
  --dry-run                  Validate and print variable key names only
  --project <id>             Expected Railway project ID
  --environment production  Target environment (production only)
  -h, --help                 Show this help
EOF
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

railway_with_scope() {
  railway "$@" "${RAILWAY_SCOPE_ARGS[@]}"
}

is_allowed_key() {
  local service="$1"
  local key="$2"

  case "$service:$key" in
    web:VITE_API_BASE_URL | web:VITE_PUBLIC_SITE_ORIGIN) return 0 ;;
    api:DATABASE_URL | api:API_ALLOWED_ORIGINS | api:HOST | api:LOG_LEVEL) return 0 ;;
    parser:DATABASE_URL | parser:LOG_LEVEL | parser:TELEGRAM_API_ID | parser:TELEGRAM_API_HASH | parser:TELEGRAM_SESSION | parser:TELEGRAM_CHANNELS | parser:TELEGRAM_BACKFILL_DAYS | parser:TELEGRAM_PAGE_SIZE | parser:OPENAI_API_KEY | parser:OPENAI_MODEL | parser:OPENAI_REQUEST_TIMEOUT_MS | parser:OPENAI_MAX_ATTEMPTS | parser:GITHUB_TOKEN) return 0 ;;
    digest:DATABASE_URL | digest:LOG_LEVEL | digest:TELEGRAM_DIGEST_BOT_TOKEN | digest:TELEGRAM_DIGEST_CHANNEL_EN | digest:TELEGRAM_DIGEST_CHANNEL_RU | digest:DIGEST_SITE_ORIGIN | digest:DIGEST_INITIAL_START_AT | digest:DIGEST_REQUEST_TIMEOUT_MS | digest:DIGEST_MAX_ATTEMPTS) return 0 ;;
    *) return 1 ;;
  esac
}

default_file_for() {
  printf '.env.railway.%s' "$1"
}

push_env() {
  local service="$1"
  local file="$2"
  local key value
  local keys=()
  local args=()

  if [[ ! -f "$file" ]]; then
    echo "Environment file not found: $file" >&2
    exit 1
  fi

  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" == \#* ]] && continue
    [[ "$line" == *"="* ]] || {
      echo "Invalid line in $file (expected KEY=VALUE)." >&2
      exit 1
    }

    key="${line%%=*}"
    value="${line#*=}"
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || {
      echo "Invalid variable name in $file: $key" >&2
      exit 1
    }
    [[ -n "$value" ]] || continue
    is_allowed_key "$service" "$key" || {
      echo "Refusing variable $key for service $service." >&2
      exit 1
    }
    if [[ " ${keys[*]-} " == *" $key "* ]]; then
      echo "Duplicate variable $key in $file." >&2
      exit 1
    fi

    value="${value#\"}"
    value="${value%\"}"
    if [[ "$key" == "DATABASE_URL" && "$value" != '${{Postgres.DATABASE_URL}}' ]]; then
      echo "DATABASE_URL for $service must use the Postgres reference variable." >&2
      exit 1
    fi

    keys+=("$key")
    args+=("${key}=${value}")
  done <"$file"

  if [[ "${#args[@]}" -eq 0 ]]; then
    echo "No non-empty variables found in $file" >&2
    exit 1
  fi

  echo "[$service] ${#keys[@]} variable keys from $file: ${keys[*]}"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "[$service] Dry run; no Railway variables changed."
    return
  fi

  railway variable set "${args[@]}" --service "$service" --skip-deploys "${RAILWAY_SCOPE_ARGS[@]}" >/dev/null
  echo "[$service] Variables pushed with values hidden."
}

dry_run_missing_file() {
  local service="$1"
  local file="$2"
  local keys=""
  case "$service" in
    digest) keys="DATABASE_URL LOG_LEVEL TELEGRAM_DIGEST_BOT_TOKEN TELEGRAM_DIGEST_CHANNEL_EN TELEGRAM_DIGEST_CHANNEL_RU DIGEST_SITE_ORIGIN DIGEST_INITIAL_START_AT DIGEST_REQUEST_TIMEOUT_MS DIGEST_MAX_ATTEMPTS" ;;
    *) return 1 ;;
  esac
  echo "[$service] Default file $file is absent; allowlisted keys: $keys"
  echo "[$service] Dry run; no Railway variables changed."
}

TARGET="${1:-}"
[[ -n "$TARGET" ]] || { usage; exit 1; }
if [[ "$TARGET" == "-h" || "$TARGET" == "--help" ]]; then
  usage
  exit 0
fi
shift

DRY_RUN=0
PROJECT=""
ENVIRONMENT="production"
FILE_OVERRIDE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --file) FILE_OVERRIDE="${2:-}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    --project) PROJECT="${2:-}"; shift 2 ;;
    --environment) ENVIRONMENT="${2:-}"; shift 2 ;;
    -h | --help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage; exit 1 ;;
  esac
done

case "$TARGET" in
  web | api | parser | digest | all) ;;
  *) echo "Unknown environment target: $TARGET" >&2; usage; exit 1 ;;
esac
[[ "$ENVIRONMENT" == "production" ]] || {
  echo "Refusing unknown environment: $ENVIRONMENT (expected production)." >&2
  exit 1
}
if [[ "$TARGET" == "all" && -n "$FILE_OVERRIDE" ]]; then
  echo "--file cannot be used with target all." >&2
  exit 1
fi

RAILWAY_SCOPE_ARGS=(--environment "$ENVIRONMENT")
[[ -n "$PROJECT" ]] && RAILWAY_SCOPE_ARGS+=(--project "$PROJECT")

TARGETS=()
if [[ "$TARGET" == "all" ]]; then
  TARGETS=(web api parser digest)
else
  TARGETS=("$TARGET")
fi

if [[ "$DRY_RUN" -eq 0 ]]; then
  require_command railway
  require_command node
  railway whoami --json >/dev/null
  status_json="$(railway_with_scope status --json)"
  EXPECTED_PROJECT="$PROJECT" EXPECTED_PROJECT_NAME="not-boring-tech" EXPECTED_ENVIRONMENT="$ENVIRONMENT" node -e '
    const fs = require("node:fs");
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    const expectedProject = process.env.EXPECTED_PROJECT;
    const expectedProjectName = process.env.EXPECTED_PROJECT_NAME;
    const expectedEnvironment = process.env.EXPECTED_ENVIRONMENT;
    if (expectedProject && data.id !== expectedProject) {
      console.error(`Refusing project ${data.id}; expected ${expectedProject}.`);
      process.exit(1);
    }
    if (data.name !== expectedProjectName) {
      console.error(`Refusing project ${data.name}; expected ${expectedProjectName}.`);
      process.exit(1);
    }
    const environments = data.environments?.edges?.map((edge) => edge.node?.name) ?? [];
    if (!environments.includes(expectedEnvironment)) {
      console.error(`Railway environment not found: ${expectedEnvironment}`);
      process.exit(1);
    }
  ' <<<"$status_json"

  available_services="$(railway_with_scope service list --json)"
  for service in "${TARGETS[@]}"; do
    SERVICE_TO_FIND="$service" node -e '
      const fs = require("node:fs");
      const services = JSON.parse(fs.readFileSync(0, "utf8"));
      if (!services.some((item) => item.name === process.env.SERVICE_TO_FIND)) {
        console.error(`Railway service not found: ${process.env.SERVICE_TO_FIND}`);
        process.exit(1);
      }
    ' <<<"$available_services"
  done
fi

for service in "${TARGETS[@]}"; do
  file="$FILE_OVERRIDE"
  [[ -n "$file" ]] || file="$(default_file_for "$service")"
  if [[ "$DRY_RUN" -eq 1 && -z "$FILE_OVERRIDE" && ! -f "$file" ]]; then
    dry_run_missing_file "$service" "$file" && continue
  fi
  push_env "$service" "$file"
done
