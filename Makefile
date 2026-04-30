dev:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

down:
	docker compose down

prod:
	bash scripts/pre-deploy.sh
	docker compose up --build -d
	bash scripts/post-deploy.sh

logs:
	docker compose logs -f

ps:
	docker compose ps

# ── 관측 스택 (Loki + Promtail + Grafana) — 옵트인
up-obs:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml -f docker-compose.observability.yml up -d --build

down-obs:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml -f docker-compose.observability.yml down

logs-obs:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml -f docker-compose.observability.yml logs -f loki promtail grafana
