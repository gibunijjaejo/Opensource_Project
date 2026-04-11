#!/bin/bash
# .env에서 DB 정보를 읽어 PostgreSQL MCP 서버를 실행합니다.
# 아이디/비밀번호가 코드에 노출되지 않도록 .env에서 동적으로 로드합니다.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: .env 파일을 찾을 수 없습니다: $ENV_FILE" >&2
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

if [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ] || [ -z "$DB_HOST" ] || [ -z "$DB_PORT" ] || [ -z "$DB_NAME" ]; then
  echo "ERROR: .env에 DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME 중 누락된 값이 있습니다." >&2
  exit 1
fi

exec npx -y @modelcontextprotocol/server-postgres \
  "postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
