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
