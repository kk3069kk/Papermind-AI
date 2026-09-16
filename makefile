.PHONY: run dev test smoke db frontend

run:
	cd backend && npm run dev

dev: run

frontend:
	cd frontend && npm run dev

test:
	cd backend && npm test

smoke:
	cd backend && npm run test:smoke

db:
	docker compose up -d postgres
