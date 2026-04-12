#!/bin/bash
set -e

BACKEND_URL="${BACKEND_URL:-http://localhost:8080}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"
MAX_RETRY=24
WAIT=5

echo "=== 배포 후 헬스체크 시작 ==="

wait_for() {
    local url=$1
    local name=$2
    echo "[$name] 응답 대기 중..."
    for i in $(seq 1 $MAX_RETRY); do
        if curl -sf "$url" > /dev/null 2>&1; then
            echo "[$name] OK (${i}회 시도)"
            return 0
        fi
        sleep $WAIT
    done
    echo "ERROR: [$name] ${MAX_RETRY}회 재시도 후 응답 없음"
    exit 1
}

# 1. 백엔드 헬스체크
wait_for "$BACKEND_URL/" "Backend"

# 2. 프론트엔드 헬스체크
wait_for "$FRONTEND_URL/" "Frontend"

# 3. API 주요 엔드포인트 확인
echo "[API] 과목 목록 엔드포인트 확인..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/api/v1/courses?year=2026&semester=1&limit=1")
if [ "$STATUS" != "200" ]; then
    echo "ERROR: 과목 API 응답 코드 $STATUS"
    exit 1
fi
echo "[API] OK ($STATUS)"

# 4. 컨테이너 상태 확인
echo "[Docker] 컨테이너 상태 확인..."
docker compose ps --format "table {{.Name}}\t{{.Status}}"

echo "=== 배포 후 헬스체크 완료 ==="
