// Nightly OWASP ZAP DAST 스캔 — dev 파이프라인과 분리된 별도 Jenkins job.
//
// 이유:
//   - DAST 는 실행 중 앱에 실제 HTTP 페이로드를 보내 응답 행동을 본다 (정적 스캔과 영역이 다름).
//   - 매 dev push 마다 돌리기엔 시간이 길고(3~10분) 비용도 큼 → 하루 한 번 야간.
//   - 결과는 같은 DefectDojo engagement 로 모여 admin/security 페이지에서 통합 가시화.
//
// Jenkins job 설정 (사람이 한 번 등록):
//   1. New Item → Pipeline → "seoganpyo-nightly-zap"
//   2. Pipeline → Definition: "Pipeline script from SCM"
//   3. SCM: Git, repo URL = upstream, Branches: dev
//   4. Script Path: Jenkinsfile.zap
//   5. Build Triggers → Build periodically: H 3 * * *  (매일 03:xx)
//
// 흐름:
//   1. dev 브랜치 checkout
//   2. 격리된 docker-compose project 로 backend 만 새로 띄움 (운영과 분리)
//   3. ZAP baseline scan — passive + 가벼운 active 룰 (전체 active 는 너무 무거움)
//   4. JSON 결과를 DefectDojo 로 업로드 (close_old_findings=true 로 픽스된 거 자동 정리)
//   5. always: 임시 compose down → 자원 정리

pipeline {
    agent any

    triggers {
        // 매일 새벽 3시대 (Jenkins 가 H 로 분 분산 — 부하 평탄화)
        cron('H 3 * * *')
    }

    environment {
        DD_URL          = 'http://163.239.77.65:8888'
        DD_TOKEN        = credentials('defectdojo-token')
        DD_ENGAGEMENT   = '1'
        DISCORD_WEBHOOK = credentials('discord-webhook')

        // 운영 컨테이너(seoganpyo-*)와 겹치지 않게 격리된 project name 사용.
        // docker compose -p zapscan up → 컨테이너 이름이 zapscan-* 로 prefix 됨.
        COMPOSE_PROJECT = 'zapscan'
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
                script {
                    env.SHORT_SHA = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
                    echo "ZAP 야간 스캔 시작 — commit ${env.SHORT_SHA}"
                }
            }
        }

        // ── 1. 격리 환경에서 backend 기동 ────────────────────────────
        // 운영 8080 / frontend 3000 과 포트 충돌 방지를 위해 포트 매핑은 빼고
        // 같은 docker network 내부에서만 서로 호출되도록 함.
        stage('Start isolated backend') {
            steps {
                sh '''
                    mkdir -p security-reports

                    # Dockerfile 의 COPY ./static ./data 가 요구하는 디렉토리.
                    # 둘 다 .gitignore 대상이라 git clone 시 받아오지 않음 — 빈 디렉토리 보장.
                    mkdir -p static/uploads/posts data

                    # docker-compose.yml 의 env_file: .env 의존성 충족.
                    # 영구 base .env 는 /var/lib/jenkins/seoganpyo-prod.env (사람이 SSH 로 한 번 작성).
                    # main 의 Deploy 스테이지와 동일한 패턴 — 시크릿은 .env 로 주입.
                    BASE_ENV="/var/lib/jenkins/seoganpyo-prod.env"
                    if [ -f "$BASE_ENV" ]; then
                        cp "$BASE_ENV" .env
                        echo "Base .env 복사 완료 ($(wc -l < .env)줄)"
                    else
                        echo "⚠️ Base .env 없음 ($BASE_ENV) — 빈 .env 로 진행 (DB 미연결로 backend 가 죽을 수 있음)"
                        touch .env
                    fi

                    # 혹시 이전 빌드 잔재가 남아있으면 정리
                    docker compose -p ${COMPOSE_PROJECT} down -v --remove-orphans || true

                    # docker-compose.zap.yml override 로 container_name 을 zapscan-* 로 갈아 끼움.
                    # 운영(seoganpyo-*) 과 격리 — 이름 충돌 방지.
                    # --no-deps: backend 의 depends_on(ocr-service healthy) 무시.
                    #   ZAP 스캔에 OCR 필요 없고, ocr-service 가 MISTRAL_API_KEY 없으면 영원히 unhealthy.
                    # 빌드 출력은 tail -20 으로 잘라서 Jenkins 콘솔 50k 한계 회피.
                    docker compose -p ${COMPOSE_PROJECT} \
                        -f docker-compose.yml \
                        -f docker-compose.zap.yml \
                        up -d --build --quiet-pull --no-deps backend redis 2>&1 | tail -20

                    echo ""
                    echo "── 컨테이너 상태 ──"
                    docker compose -p ${COMPOSE_PROJECT} -f docker-compose.yml -f docker-compose.zap.yml ps

                    echo ""
                    echo "── backend health 대기 (최대 120초) ──"
                    # container_name override 후엔 zapscan-api 이름이 됨 (compose suffix -1 없음)
                    HEALTHY=0
                    for i in $(seq 1 60); do
                        STATE=$(docker inspect -f '{{.State.Health.Status}}' zapscan-api 2>/dev/null || echo "missing")
                        if [ "$STATE" = "healthy" ]; then
                            echo "  [$i/60] backend = healthy ✓"
                            HEALTHY=1
                            break
                        fi
                        if [ $((i % 10)) -eq 0 ]; then
                            echo "  [$i/60] backend = $STATE"
                        fi
                        sleep 2
                    done

                    if [ "$HEALTHY" = "0" ]; then
                        echo ""
                        echo "⚠️ backend 가 healthy 되지 않음 — 진단 로그 출력"
                        echo ""
                        echo "── docker ps -a ──"
                        docker ps -a --filter "name=zapscan" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
                        echo ""
                        echo "── zapscan-api logs (last 50 lines) ──"
                        docker logs zapscan-api --tail 50 2>&1 || echo "(zapscan-api container not found)"
                        echo ""
                        echo "── zapscan-redis logs (last 10 lines) ──"
                        docker logs zapscan-redis --tail 10 2>&1 || echo "(zapscan-redis container not found)"
                        echo ""
                        echo "ZAP 스캔은 계속 시도 — backend 가 일부라도 응답하면 baseline 결과 수집 가능"
                    fi
                '''
            }
        }

        // ── 2. ZAP baseline 스캔 ─────────────────────────────────────
        // baseline 은 passive scan + 짧은 active 룰 (5~10분).
        // full active scan 은 시간 30분+ — 추후 주간 1회로 분리 가능.
        stage('ZAP Baseline Scan') {
            steps {
                sh '''
                    # zapscan-api 컨테이너가 붙어 있는 docker network 이름 추출.
                    NETWORK=$(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}' zapscan-api 2>/dev/null || echo "")
                    if [ -z "$NETWORK" ]; then
                        echo "⚠️ zapscan-api 컨테이너 미존재 또는 network 없음 — ZAP 스킵"
                        exit 0
                    fi
                    echo "ZAP network: $NETWORK"

                    # ZAP 컨테이너는 내부 zap user 로 실행 → 마운트된 호스트 디렉토리(jenkins ownership)에
                    # 쓰기 권한이 없어 결과 파일 생성 실패 (Permission denied).
                    # OWASP ZAP docker 공식 가이드대로 쓰기 권한 풀어주기.
                    chmod 777 security-reports

                    # ZAP baseline — 결과는 /zap/wrk 마운트 디렉토리(=workspace/security-reports)에 저장.
                    # -t 대상: 같은 network 안의 backend 컨테이너 이름:포트
                    # -I : passive scan 중 alert 있어도 exit 0 으로 (빌드 계속)
                    docker run --rm \
                        --network "$NETWORK" \
                        -v "$(pwd)/security-reports:/zap/wrk:rw" \
                        zaproxy/zap-stable \
                        zap-baseline.py \
                            -t http://zapscan-api:8000 \
                            -J zap-baseline.json \
                            -r zap-baseline.html \
                            -I

                    ls -la security-reports/
                '''
            }
        }

        // ── 3. DefectDojo 업로드 ─────────────────────────────────────
        stage('Upload ZAP to Defect Dojo') {
            steps {
                sh '''
                    if [ -s "security-reports/zap-baseline.json" ]; then
                        curl -sf -X POST "${DD_URL}/api/v2/import-scan/" \
                            -H "Authorization: Token ${DD_TOKEN}" \
                            -F "scan_type=ZAP Scan" \
                            -F "engagement=${DD_ENGAGEMENT}" \
                            -F "file=@security-reports/zap-baseline.json" \
                            -F "active=true" \
                            -F "verified=false" \
                            -F "close_old_findings=true" \
                            -F "branch_tag=nightly-zap" \
                            -F "build_id=${BUILD_NUMBER}" \
                            > /dev/null && echo "Uploaded: zap-baseline.json"
                    else
                        echo "zap-baseline.json 없음 — 스캔 실패 가능, 업로드 스킵"
                    fi
                '''
            }
        }
    }

    post {
        // 빌드 성공/실패와 무관하게 항상 정리 — 자원 누수 방지.
        // 두 compose 파일 모두 인자로 줘야 container_name override 가 인식돼 깨끗하게 정리됨.
        always {
            sh '''
                docker compose -p ${COMPOSE_PROJECT} -f docker-compose.yml -f docker-compose.zap.yml down -v --remove-orphans || true
            '''
        }
        success {
            sh '''
                curl -s -X POST "${DISCORD_WEBHOOK}" \
                  -H "Content-Type: application/json" \
                  -d "{\\"username\\": \\"Jenkins ZAP\\", \\"content\\": \\"🛡️ **야간 ZAP DAST 스캔 완료** — 빌드 #${BUILD_NUMBER} | commit ${SHORT_SHA}\\"}" || true
            '''
        }
        failure {
            sh '''
                curl -s -X POST "${DISCORD_WEBHOOK}" \
                  -H "Content-Type: application/json" \
                  -d "{\\"username\\": \\"Jenkins ZAP\\", \\"content\\": \\"❌ **야간 ZAP 스캔 실패** — 빌드 #${BUILD_NUMBER} | commit ${SHORT_SHA}\\"}" || true
            '''
        }
    }
}
