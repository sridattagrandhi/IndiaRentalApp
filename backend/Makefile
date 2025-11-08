.PHONY: bootstrap dev api migrate

bootstrap:
	cd apps/api && poetry install

# hot-reload on :4000
dev:
	cd apps/api && poetry run uvicorn --app-dir src api.main:app --reload --host 0.0.0.0 --port 4000

# no reload (handy for logs)
api:
	cd apps/api && poetry run uvicorn --app-dir src api.main:app --host 0.0.0.0 --port 4000

# run latest DB migrations against whatever DATABASE_URL is set in this shell
migrate:
	cd apps/api && DATABASE_URL="$$DATABASE_URL" poetry run alembic upgrade head
