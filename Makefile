.PHONY: setup test lint format-check

setup:
	uv sync --locked --group dev
	uv run --locked pre-commit install

test: lint format-check
	uv run --locked pytest

lint:
	uv run --locked ruff check .

format-check:
	uv run --locked ruff format --check .
