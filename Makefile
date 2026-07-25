.PHONY: install dev backend frontend test lint build clean

install:
	cd backend && python3 -m venv .venv && .venv/bin/pip install -q -e ".[dev]"
	cd frontend && npm install

backend:
	cd backend && .venv/bin/python -m uvicorn app.main:app --reload --port 8000

frontend:
	cd frontend && npm run dev

# Два процесса в одном терминале: шлюз на :8000, витрина на :3000.
dev:
	@$(MAKE) -j2 backend frontend

test:
	cd backend && .venv/bin/python -m pytest -q

lint:
	cd backend && .venv/bin/ruff check app tests && .venv/bin/ruff format --check app tests
	cd frontend && npx tsc --noEmit && npm run lint

build:
	cd frontend && npm run build

clean:
	rm -rf backend/.venv backend/.pytest_cache backend/.ruff_cache frontend/.next frontend/node_modules
