.DEFAULT_GOAL := help

UV ?= uv
IMAGE ?= riverbank-hackathon:base-01
PLATFORM ?= linux/arm64

.PHONY: help setup sync test run db-tunnel services-tunnel docker-build docker-smoke services-smoke

help:
	@echo "setup: install locked dependencies and local pre-commit hooks"
	@echo "sync: install locked dependencies without modifying Git hooks (CI)"
	@echo "test: sync locked dependencies, Ruff lint/format and pytest, offline"
	@echo "run: start the API using api/config.py"
	@echo "db-tunnel: forward localhost:15432 to the configured private RDS"
	@echo "docker-build: build and load an image (default: linux/arm64)"
	@echo "docker-smoke: start that image and check HTTP /health"

sync:
	$(UV) sync --locked --dev

setup: sync
	$(UV) run --offline --no-sync pre-commit install

test:
	$(UV) sync --locked --dev --offline
	bash -n infra/deploy.sh
	$(UV) run --offline --no-sync ruff check api scripts
	$(UV) run --offline --no-sync ruff format --check api scripts
	$(UV) run --offline --no-sync cfn-lint infra/platform.yaml
	$(UV) run --offline --no-sync pytest

run:
	$(UV) run --offline --no-sync python -m api

db-tunnel:
	$(UV) run --offline --no-sync python -m scripts.db_tunnel

services-tunnel:
	$(UV) run --offline --no-sync python -m scripts.db_tunnel --services

docker-build:
	docker buildx build --platform $(PLATFORM) --load --tag $(IMAGE) .

docker-smoke:
	$(UV) run --offline --no-sync python scripts/docker_smoke.py --image $(IMAGE) --platform $(PLATFORM)

services-smoke:
	$(UV) run --offline --no-sync python scripts/services_smoke.py --platform $(PLATFORM) --api-image $(IMAGE)
