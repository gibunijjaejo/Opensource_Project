pipeline {
    agent any

    environment {
        BACKEND_URL     = 'http://localhost:8080'
        FRONTEND_URL    = 'http://localhost:3000'
        DISCORD_WEBHOOK = credentials('discord-webhook')
        FAILED_STAGE    = 'Unknown'   // 실패 단계 추적용 (각 stage에서 덮어씀)
    }

    stages {

        // ── 1. 소스 체크아웃 ──────────────────────────────────────────
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    def commit = sh(script: 'git rev-parse HEAD', returnStdout: true).trim()
                    def marker = "/var/lib/jenkins/.seoganpyo_last_commit"
                    def last   = sh(script: "cat ${marker} 2>/dev/null || echo ''", returnStdout: true).trim()
                    if (last == commit) {
                        echo "동일 커밋(${commit.take(8)}) — 재빌드 건너뜀"
                        currentBuild.result = 'ABORTED'
                        throw new org.jenkinsci.plugins.workflow.steps.FlowInterruptedException(
                            hudson.model.Result.ABORTED
                        )
                    }
                    sh "echo '${commit}' > ${marker}"
                    echo "브랜치: ${env.GIT_BRANCH} | 커밋: ${commit.take(8)}"
                }
            }
        }

        // ── 2. CI: 코드 품질 점검 ─────────────────────────────────────
        stage('CI - Lint & Check') {
            steps {
                script { env.FAILED_STAGE = 'CI - Lint & Check' }
            }
            parallel {

                stage('Backend Lint') {
                    steps {
                        sh '''
                            python3 -m venv .venv-lint
                            .venv-lint/bin/pip install ruff --quiet
                            .venv-lint/bin/ruff check app/ --output-format=github
                        '''
                    }
                }

                stage('Frontend Build') {
                    steps {
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

        // ── 3. 테스트 & 커버리지 ─────────────────────────────────────
        stage('Test & Coverage') {
            steps {
                script { env.FAILED_STAGE = 'Test & Coverage' }
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

        // ── 4. SonarQube 정적 분석 ───────────────────────────────────
        stage('SonarQube Analysis') {
            steps {
                script { env.FAILED_STAGE = 'SonarQube Analysis' }
                withSonarQubeEnv('sonarqube') {
                    script {
                        def scannerHome = tool 'sonar'
                        sh "${scannerHome}/bin/sonar-scanner -Dsonar.login=${SONAR_AUTH_TOKEN}"
                    }
                }
            }
        }

        stage('Quality Gate') {
            steps {
                script { env.FAILED_STAGE = 'Quality Gate' }
                timeout(time: 5, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        // ── 5. 배포 전 점검 ───────────────────────────────────────────
        stage('Pre-Deploy Check') {
            steps {
                script { env.FAILED_STAGE = 'Pre-Deploy Check' }
                sh 'bash scripts/pre-deploy.sh'
            }
        }

        // ── 6. Docker 빌드 & 배포 ─────────────────────────────────────
        stage('Deploy') {
            steps {
                script { env.FAILED_STAGE = 'Deploy' }
                sh '''
                    docker compose down --remove-orphans || true
                    docker compose up --build -d
                '''
            }
        }

        // ── 7. 배포 후 헬스체크 ───────────────────────────────────────
        stage('Post-Deploy Check') {
            steps {
                script { env.FAILED_STAGE = 'Post-Deploy Check' }
                sh 'bash scripts/post-deploy.sh'
            }
        }

    }

    post {
        success {
            // Discord Embed 카드 (성공)
            sh '''
                python3 scripts/analyze_logs.py \
                  --mode success \
                  --build-number "${BUILD_NUMBER}" \
                  --branch "${GIT_BRANCH}" \
                  --webhook "${DISCORD_WEBHOOK}" \
                || curl -s -X POST "$DISCORD_WEBHOOK" \
                     -H "Content-Type: application/json" \
                     -d "{\\"username\\": \\"Jenkins\\", \\"content\\": \\"✅ **배포 성공** — 빌드 #${BUILD_NUMBER} | ${GIT_BRANCH}\\"}"
            '''
        }
        failure {
            // Docker 컨테이너 로그 수집 → Groq AI 분석 → Discord Embed 카드 (실패)
            sh '''
                python3 scripts/analyze_logs.py \
                  --mode failure \
                  --build-number "${BUILD_NUMBER}" \
                  --branch "${GIT_BRANCH}" \
                  --failed-stage "${FAILED_STAGE}" \
                  --webhook "${DISCORD_WEBHOOK}" \
                  --containers seoganpyo-api seoganpyo-frontend seoganpyo-ocr \
                || curl -s -X POST "$DISCORD_WEBHOOK" \
                     -H "Content-Type: application/json" \
                     -d "{\\"username\\": \\"Jenkins\\", \\"content\\": \\"❌ **빌드 실패** — 빌드 #${BUILD_NUMBER} | ${GIT_BRANCH} | 실패 단계: ${FAILED_STAGE}\\"}"
            '''
        }
    }
}
