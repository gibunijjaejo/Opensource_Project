#!/bin/bash
set -e

echo "=== 배포 전 점검 시작 ==="

# 1. .env 파일 존재 여부
echo "[1/4] .env 파일 확인..."
if [ ! -f ".env" ]; then
    echo "ERROR: .env 파일이 없습니다."
    exit 1
fi

# 2. 필수 환경변수 확인
echo "[2/4] 필수 환경변수 확인..."
REQUIRED_VARS=("DB_USER" "DB_PASSWORD" "DB_HOST" "DB_NAME" "SENDER_EMAIL")
for var in "${REQUIRED_VARS[@]}"; do
    if ! grep -q "^${var}=" .env; then
        echo "ERROR: .env에 ${var}가 없습니다."
        exit 1
    fi
done

# 3. Docker 실행 여부 확인
echo "[3/4] Docker 데몬 확인..."
if ! docker info > /dev/null 2>&1; then
    echo "ERROR: Docker가 실행 중이지 않습니다."
    exit 1
fi

# 4. data/syllabi 디렉토리 확인
echo "[4/4] 정적 파일 디렉토리 확인..."
mkdir -p data/syllabi static/uploads/posts reports

echo "=== 배포 전 점검 완료 ==="
