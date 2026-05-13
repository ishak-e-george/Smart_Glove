.PHONY: install run migrate test clean-orphans seed mock-data preprocess

install:
	pip install -r requirements.txt
	pip install -r requirements-dev.txt

run:
	uvicorn app.main:app --reload

migrate:
	alembic upgrade head

test:
	python -m pytest

seed:
	python -m app.scripts.seed_demo_data

mock-data:
	python -m app.scripts.generate_mock_recordings

preprocess:
	python -m app.scripts.preprocess_recordings

clean-orphans:
	python -m app.scripts.cleanup_orphans --apply
