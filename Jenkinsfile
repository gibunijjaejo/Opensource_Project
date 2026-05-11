pipeline {
    agent any

    environment {
        BACKEND_URL     = 'http://localhost:8080'
        FRONTEND_URL    = 'http://localhost:3000'
        DISCORD_WEBHOOK = credentials('discord-webhook')
        FAILED_STAGE    = 'Unknown'
    }

    stages {

        // ── 1. 소스 체크아웃 ──────────────────────────────────────────
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    env.BRANCH_SHORT = env.GIT_BRANCH.replaceAll('origin/', '')
                    def commit = sh(script: 'git rev-parse HEAD', returnStdout: true).trim()
                    def branchSlug = env.BRANCH_SHORT.replaceAll('/', '_')
                    def marker = "/var/lib/jenkins/.seoganpyo_last_commit_${branchSlug}"
                    def last   = sh(script: "cat ${marker} 2>/dev/null || echo ''", returnStdout: true).trim()
                    def isManual = currentBuild.getBuildCauses('hudson.model.Cause$UserIdCause').size() > 0
                    if (!isManual && last == commit) {
                        echo "동일 커밋(${commit.take(8)}) — 재빌드 건너뜀"
                        currentBuild.result = 'ABORTED'
                        throw new org.jenkinsci.plugins.workflow.steps.FlowInterruptedException(
                            hudson.model.Result.ABORTED
                        )
                    }
                    if (isManual) echo "수동 빌드 — 동일 커밋 체크 건너뜀"
                    sh "echo '${commit}' > ${marker}"
                    echo "브랜치: ${env.BRANCH_SHORT} | 커밋: ${commit.take(8)}"
                }
            }
        }

        // ── 2. CI: 코드 품질 점검 (dev 전용) ─────────────────────────
        stage('CI - Lint & Check') {
            parallel {

                stage('Backend Lint') {
                    when { expression { return env.BRANCH_SHORT == 'dev' } }
                    steps {
                        script { currentBuild.description = 'Backend Lint' }
                        sh '''
                            python3 -m venv .venv-lint
                            .venv-lint/bin/pip install ruff --quiet
                            .venv-lint/bin/ruff check app/ --output-format=github
                        '''
                    }
                }

                stage('Frontend Build') {
                    when { expression { return env.BRANCH_SHORT == 'dev' } }
                    steps {
                        script { currentBuild.description = 'Frontend Build' }
                        dir('frontend') {
                            sh '''
                                /usr/bin/npm install --prefix $HOME/.npm-global pnpm@10.32.1 --quiet
                                PNPM="$HOME/.npm-global/node_modules/.bin/pnpm"
                                export COREPACK_ENABLE_STRICT=0
                                $PNPM install --frozen-lockfile
                                $PNPM build
                            '''
                        }
                    }
                }

            }
        }

        // ── 3. 테스트 & 커버리지 (dev 전용) ─────────────────────────
        stage('Test & Coverage') {
            when { expression { return env.BRANCH_SHORT == 'dev' } }
            steps {
                script { currentBuild.description = 'Test & Coverage' }
                sh '''
                    python3 -m venv .venv-test
                    .venv-test/bin/pip install -r requirements.txt --quiet
                    mkdir -p reports
                    TEST_DATABASE_URL=sqlite:///./test_ci.db \
                    SECRET_KEY=ci-test-secret \
                    .venv-test/bin/python -m pytest tests/ \
                        --junit-xml=reports/test-results.xml \
                        --cov=app \
                        --cov-report=xml:reports/coverage.xml \
                        --cov-report=term-missing \
                        -v
                '''
            }
            post {
                always {
                    junit 'reports/test-results.xml'
                }
                success {
                    echo "테스트 통과"
                }
                failure {
                    echo "테스트 실패 — reports/test-results.xml 확인"
                }
            }
        }

        // ── 4. 보안 스캔 (dev 전용) ──────────────────────────────────
        stage('Security Scan') {
            when { expression { return env.BRANCH_SHORT == 'dev' } }
            steps {
                script { currentBuild.description = 'Security Scan' }
                sh '''
                    mkdir -p security-reports

                    docker run --rm -v "$(pwd)":/src \
                        aquasec/trivy:latest fs \
                        --format json \
                        --output /src/security-reports/trivy-fs.json \
                        --severity HIGH,CRITICAL \
                        --scanners vuln,secret,config \
                        /src || true

                    ls -la security-reports/
                '''
            }
        }

        // ── 4-2. DefectDojo로 결과 업로드 (dev 전용) ────────────────
        stage('Upload to Defect Dojo') {
            when { expression { return env.BRANCH_SHORT == 'dev' } }
            environment {
                DD_URL        = 'http://163.239.77.65:8888'
                DD_TOKEN      = credentials('defectdojo-token')
                DD_ENGAGEMENT = '1'
            }
            steps {
                sh '''
                    if [ -s "security-reports/trivy-fs.json" ]; then
                        curl -sf -X POST "${DD_URL}/api/v2/import-scan/" \
                            -H "Authorization: Token ${DD_TOKEN}" \
                            -F "scan_type=Trivy Scan" \
                            -F "engagement=${DD_ENGAGEMENT}" \
                            -F "file=@security-reports/trivy-fs.json" \
                            -F "active=true" \
                            -F "verified=false" \
                            -F "close_old_findings=true" \
                            -F "branch_tag=${BRANCH_SHORT}" \
                            -F "build_id=${BUILD_NUMBER}" \
                            > /dev/null && echo "Uploaded: trivy-fs.json"
                    else
                        echo "No trivy-fs.json to upload"
                    fi
                '''
            }
        }

        // ── 5. 배포 전 점검 (main 전용) ──────────────────────────────
        stage('Pre-Deploy Check') {
            when { expression { return env.BRANCH_SHORT == 'main' } }
            steps {
                script { currentBuild.description = 'Pre-Deploy Check' }
                sh 'bash scripts/pre-deploy.sh'
            }
        }

        // ── 6. Docker 빌드 & 배포 (main 전용) ───────────────────────
        stage('Deploy') {
            when { expression { return env.BRANCH_SHORT == 'main' } }
            environment {
                // Jenkins Credentials(Secret text)에서 API 키 주입.
                // admin 챗 UI / 포트폴리오 AI 평가에서 사용.
                GEMINI_API_KEY = credentials('gemini-api-key')
                // ocr-service의 시간표/강의계획서 OCR에서 사용.
                MISTRAL_API_KEY = credentials('mistral-api-key')
            }
            steps {
                script { currentBuild.description = 'Deploy' }
                sh '''
                    set +x
                    # .env 파일에 API 키들 갱신 (기존 라인 제거 후 새로 추가)
                    touch .env
                    sed -i '/^GEMINI_API_KEY=/d' .env
                    echo "GEMINI_API_KEY=${GEMINI_API_KEY}" >> .env
                    sed -i '/^MISTRAL_API_KEY=/d' .env
                    echo "MISTRAL_API_KEY=${MISTRAL_API_KEY}" >> .env
                    set -x

                    docker compose stop backend frontend ocr-service redis || true
                    docker compose rm -f backend frontend ocr-service redis || true
                    docker compose -f docker-compose.yml -f docker-compose.observability.app.yml \
                        up --build -d backend frontend ocr-service redis promtail
                '''
            }
        }

        // ── 7. 배포 후 헬스체크 (main 전용) ─────────────────────────
        stage('Post-Deploy Check') {
            when { expression { return env.BRANCH_SHORT == 'main' } }
            steps {
                script { currentBuild.description = 'Post-Deploy Check' }
                sh 'bash scripts/post-deploy.sh'
            }
        }

    }

    post {
        success {
            // Discord Embed 카드 (성공)
            script {
                def cleanBranch = env.BRANCH_SHORT ?: env.GIT_BRANCH.replaceAll('origin/', '')
                sh """
                    /var/lib/jenkins/.venv-scripts/bin/python3 scripts/analyze_logs.py \
                      --mode success \
                      --build-number "${env.BUILD_NUMBER}" \
                      --branch "${cleanBranch}" \
                      --webhook "${env.DISCORD_WEBHOOK}" \
                    || curl -s -X POST "${env.DISCORD_WEBHOOK}" \
                         -H "Content-Type: application/json" \
                         -d "{\\"username\\": \\"Jenkins\\", \\"content\\": \\"✅ **배포 성공** — 빌드 #${env.BUILD_NUMBER} | ${cleanBranch}\\"}"
                """
            }
        }
        failure {
            // Docker 컨테이너 로그 수집 → AI 분석 → Discord Embed 카드 (실패)
            script {
                def cleanBranch = env.BRANCH_SHORT ?: env.GIT_BRANCH.replaceAll('origin/', '')
                sh """
                    /var/lib/jenkins/.venv-scripts/bin/python3 scripts/analyze_logs.py \
                      --mode failure \
                      --build-number "${env.BUILD_NUMBER}" \
                      --branch "${cleanBranch}" \
                      --failed-stage "${currentBuild.description ?: 'Unknown'}" \
                      --webhook "${env.DISCORD_WEBHOOK}" \
                      --containers seoganpyo-api seoganpyo-frontend seoganpyo-ocr \
                    || curl -s -X POST "${env.DISCORD_WEBHOOK}" \
                         -H "Content-Type: application/json" \
                         -d "{\\"username\\": \\"Jenkins\\", \\"content\\": \\"❌ **빌드 실패** — 빌드 #${env.BUILD_NUMBER} | ${cleanBranch} | 실패 단계: ${currentBuild.description ?: 'Unknown'}\\"}"
                """
            }
        }
    }
}
