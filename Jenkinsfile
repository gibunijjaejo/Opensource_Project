pipeline {
    agent any

    environment {
        BACKEND_URL  = 'http://localhost:8088'
        FRONTEND_URL = 'http://localhost:3000'
    }

    stages {

        // ── 1. 소스 체크아웃 ──────────────────────────────────────────
        stage('Checkout') {
            steps {
                checkout scm
                echo "브랜치: ${env.GIT_BRANCH} | 커밋: ${env.GIT_COMMIT?.take(8)}"
            }
        }

        // ── 2. CI: 코드 품질 점검 ─────────────────────────────────────
        stage('CI - Lint & Check') {
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

        // ── 4. 배포 전 점검 ───────────────────────────────────────────
        stage('Pre-Deploy Check') {
            steps {
                sh 'bash scripts/pre-deploy.sh'
            }
        }

        // ── 5. Docker 빌드 & 배포 ─────────────────────────────────────
        stage('Deploy') {
            steps {
                sh '''
                    docker compose down --remove-orphans || true
                    docker compose up --build -d
                '''
            }
        }

        // ── 6. 배포 후 헬스체크 ───────────────────────────────────────
        stage('Post-Deploy Check') {
            steps {
                sh 'bash scripts/post-deploy.sh'
            }
        }

    }

    post {
        success {
            echo '배포 성공'
        }
        failure {
            echo '파이프라인 실패 — 로그를 확인하세요'
        }
    }
}
