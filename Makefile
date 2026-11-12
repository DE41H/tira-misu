.PHONY: dev build tidy migration

dev:
	cd backend && go run . serve

build:
	cd backend && go build -o tira .

tidy:
	cd backend && go mod tidy

# usage: make migration name=create_tasks
migration:
	cd backend && go run . migrate create $(name)
