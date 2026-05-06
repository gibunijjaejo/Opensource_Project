FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV TZ=Asia/Seoul

WORKDIR /app

# docker CLI — admin_assistant.get_container_status가 호출 (admin 챗 UI 운영 어시스턴트용).
# 호스트 docker.sock을 /var/run/docker.sock에 마운트해야 동작 (docker-compose.dev.yml).
# Debian의 docker.io 패키지는 daemon만 설치(client 분리)라, 공식 static binary로 client만 받음.
ARG DOCKER_CLI_VERSION=27.5.1
# hadolint ignore=DL3008
# curl/ca-certificates는 docker CLI 다운로드용 임시 패키지 — 같은 RUN 내에서 purge되므로 버전 핀 불필요.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && curl -fsSL "https://download.docker.com/linux/static/stable/x86_64/docker-${DOCKER_CLI_VERSION}.tgz" \
         -o /tmp/docker.tgz \
    && tar -xzf /tmp/docker.tgz -C /tmp \
    && mv /tmp/docker/docker /usr/local/bin/docker \
    && chmod +x /usr/local/bin/docker \
    && rm -rf /tmp/docker /tmp/docker.tgz \
    && apt-get purge -y curl \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

# 종속성 설치
COPY requirements.txt .
RUN pip install --no-cache-dir --timeout 300 --retries 5 -r requirements.txt

# 애플리케이션 코드 및 데이터 복사
COPY ./app ./app
COPY ./static ./static
COPY ./data ./data

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
