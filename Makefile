.PHONY: help build test lint validate clean all

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ============ Docker Commands ============

build: ## Build all Docker containers
	docker compose build

up: ## Start all services (frontend dev server + dynamodb)
	docker compose up frontend dynamodb-local

down: ## Stop all services
	docker compose down

clean: ## Remove all containers and volumes
	docker compose down -v --rmi local

# ============ Testing ============

test-backend: ## Run backend tests in Docker
	docker compose run --rm backend npm test

test-backend-coverage: ## Run backend tests with coverage
	docker compose run --rm backend npm run test:coverage

test-frontend: ## Run frontend type check, unit tests, and build
	docker compose run --rm frontend npm run typecheck
	docker compose run --rm frontend npm test
	docker compose run --rm frontend npm run build

test-all: test-backend test-frontend ## Run all tests

# ============ Linting ============

lint-backend: ## Lint backend code
	docker compose run --rm backend npm run lint

lint-frontend: ## Lint frontend code
	docker compose run --rm frontend npm run lint

lint-all: lint-backend lint-frontend ## Lint all code

# ============ Validation ============

validate-terraform: ## Validate Terraform configuration
	docker compose run --rm terraform

validate-all: validate-terraform lint-all test-all ## Run all validations

# ============ Build ============

build-backend: ## Build backend Lambda functions
	docker compose run --rm backend npm run build

build-frontend: ## Build frontend for production
	docker compose run --rm frontend npm run build

build-all: build-backend build-frontend ## Build everything

# ============ All-in-one ============

all: build validate-all ## Build and validate everything
	@echo "All validations passed!"
