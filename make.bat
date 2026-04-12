@echo off
if "%1"=="dev" (
    docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
) else if "%1"=="down" (
    docker compose down
) else if "%1"=="prod" (
    bash scripts/pre-deploy.sh
    docker compose up --build -d
    bash scripts/post-deploy.sh
) else if "%1"=="logs" (
    docker compose logs -f
) else if "%1"=="ps" (
    docker compose ps
) else (
    echo 사용법: make.bat [dev^|down^|prod^|logs^|ps]
)
