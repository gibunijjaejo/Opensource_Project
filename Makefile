COMPOSE     = docker-compose.yml
COMPOSE_DEV = docker-compose.dev.yml
COMPOSE_OBS = docker-compose.observability.yml

DC_DEV      = docker compose -f $(COMPOSE) -f $(COMPOSE_DEV)
DC_PROD     = docker compose -f $(COMPOSE)
DC_OBS      = docker compose -f $(COMPOSE) -f $(COMPOSE_DEV) -f $(COMPOSE_OBS)
DC_PROD_OBS = docker compose -f $(COMPOSE) -f $(COMPOSE_OBS)

# ── 로컬 개발 ─────────────────────────────────────────
dev:
	$(DC_DEV) up --build

down:
	$(DC_DEV) down

logs:
	$(DC_DEV) logs -f

ps:
	$(DC_DEV) ps

# ── 프로덕션 배포 ──────────────────────────────────────
prod:
	bash scripts/pre-deploy.sh
	$(DC_PROD) up --build -d
	bash scripts/post-deploy.sh

prod-down:
	$(DC_PROD) down

prod-logs:
	$(DC_PROD) logs -f

# ── 관측 스택 (Loki + Promtail + Grafana) — 옵트인 ────
# 로컬 개발용 (make dev 위에 덧붙임)
up-obs:
	$(DC_OBS) up -d --build

down-obs:
	$(DC_OBS) down

logs-obs:
	$(DC_OBS) logs -f loki promtail grafana

# 팀 서버용 (make prod 위에 덧붙임 — 앱+관측 한 서버에 같이)
prod-up-obs:
	$(DC_PROD_OBS) up -d --build

prod-down-obs:
	$(DC_PROD_OBS) down

prod-logs-obs:
	$(DC_PROD_OBS) logs -f loki promtail grafana

# ── 모니터링 서버 분리 구조 ────────────────────────────
# 앱 서버 (163.239.77.77) — Promtail만 (원격 Loki로 push)
prod-up-obs-app:
	docker compose -f $(COMPOSE) -f docker-compose.observability.app.yml up -d --build promtail

prod-down-obs-app:
	docker compose -f $(COMPOSE) -f docker-compose.observability.app.yml stop promtail && docker compose -f $(COMPOSE) -f docker-compose.observability.app.yml rm -f promtail

prod-logs-obs-app:
	docker logs -f seoganpyo-promtail

# 모니터링 서버 (163.239.77.66) — Loki + Prometheus + Grafana
obs-server-up:
	docker compose -f docker-compose.observability.server.yml up -d --build

obs-server-down:
	docker compose -f docker-compose.observability.server.yml down

obs-server-logs:
	docker compose -f docker-compose.observability.server.yml logs -f
