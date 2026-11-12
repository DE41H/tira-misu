.PHONY: clean build serve

clean:
	cd backend && go mod tidy
	docker builder prune -f

build:
	docker build -f docker/Dockerfile --secret id=env,src=.env -o backend .

serve:
	cd backend && ./tira serve $(DOMAIN)
