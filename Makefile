.PHONY: clean build upgrade serve

clean:
	docker builder prune -f

build:
	docker build -f docker/Dockerfile --secret id=env,src=.env -o backend .

upgrade:
	docker build --no-cache -f docker/Dockerfile.upgrade -o backend/pb_hooks .

serve:
	cd backend && set -a && { [ ! -f ../.env ] || . ../.env; } && set +a && ./pocketbase serve $(DOMAIN)
