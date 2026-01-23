# Serverless Chat Application

Real-time WebSocket chat built on AWS serverless primitives with a Vue 3 frontend. This repository contains everything from infrastructure as code to frontend and backend sources.

- Docs: `docs/architecture.md` (system design), `todo.md` (deployment runbook)

## Highlights
- WebSocket messaging via API Gateway + Lambda + DynamoDB
- Cognito-based auth with optional mocked auth for local work
- Fully IaC with Terraform (VPC, networking, data, hosting)
- TypeScript end-to-end; linting, tests, and builds runnable via Docker/Make

## Stack

| Area | Details |
|------|---------|
| Frontend | Vue 3 + TypeScript + Vite + Tailwind |
| Backend | AWS Lambda (Node.js 20, TypeScript, esbuild) |
| Messaging | API Gateway WebSocket routes: `$connect`, `$disconnect`, `sendMessage`, `getMessages` |
| Data | DynamoDB tables: connections, messages (GSI on userId) |
| Auth | Cognito User Pool (email login). Local dev can mock auth. |
| Delivery | S3 + CloudFront (SPA), VPC with NAT for Lambdas |
| IaC / CI | Terraform, GitHub Actions (lint/test/security + deploy) |

## Repository Layout

```
.
├── backend/                 # Lambda functions (TypeScript + Jest + ESLint)
├── frontend/                # Vue app (Vitest + ESLint + Tailwind)
├── infrastructure/          # Terraform (VPC, API GW, Lambda, DynamoDB, Cognito, S3/CloudFront)
├── docs/                    # Architecture + status docs
├── screenshots/             # UI snapshots
├── docker-compose.yml       # Local dev/test toolchain
└── Makefile                 # Convenience targets
```

## Local Development

### Prerequisites
- Docker + Docker Compose
- Make (optional, simplifies commands)
- Node 20+ only if you want to run packages outside Docker
- Terraform >= 1.6 and AWS CLI for deployments

### Quick Start (Docker + Make)
```bash
# First build images (one-time or after dependency changes)
make build

# Start frontend dev server + DynamoDB Local
make up   # http://localhost:3000

# Stop containers/volumes when done
make down
```

### Validation and Tests
```bash
make test-backend           # Jest (unit + integration) in Docker
make test-frontend          # Typecheck + Vitest + build in Docker
make lint-all               # ESLint for backend + frontend
make validate-terraform     # terraform init -backend=false && validate
make validate-all           # lint + tests + terraform validate
```

### Without Make
```bash
docker compose build
docker compose up frontend dynamodb-local
docker compose run --rm backend npm test
docker compose run --rm frontend npm run typecheck && docker compose run --rm frontend npm test && docker compose run --rm frontend npm run build
docker compose run --rm terraform
docker compose down
```

## Environment Configuration

### Frontend `.env`
Create `frontend/.env` for any build beyond the mocked local defaults:
```env
VITE_WEBSOCKET_URL=wss://<api-id>.execute-api.<region>.amazonaws.com/<stage>
VITE_COGNITO_USER_POOL_ID=<user-pool-id>
VITE_COGNITO_CLIENT_ID=<app-client-id>
VITE_AWS_REGION=<aws-region>
# Optional: bypass Cognito for local-only development
VITE_MOCK_AUTH=true
```
`docker-compose.yml` ships with `VITE_MOCK_AUTH=true` and dummy IDs so the UI works without Cognito.

### Backend (Lambda / Docker)
| Variable | Purpose | Default in Docker |
|----------|---------|-------------------|
| `CONNECTIONS_TABLE` | DynamoDB connections table | `chat-connections` |
| `MESSAGES_TABLE` | DynamoDB messages table | `chat-messages` |
| `AWS_REGION` | AWS region used by SDK | `eu-central-1` |
| `DYNAMODB_ENDPOINT` | Override for DynamoDB Local (integration tests) | `http://dynamodb-local:8000` |

## Infrastructure & Deployment
- Remote state is enabled in `infrastructure/main.tf` and expects:
  - S3 bucket: `serverless-chat-terraform-state-us-east-1`
  - DynamoDB table: `terraform-state-lock` (PK `LockID`)
  Create these (or update names) before running `terraform init`.
- Validate locally without touching AWS:
  ```bash
  docker compose run --rm terraform   # init -backend=false + validate
  ```
- Deploy (with AWS credentials configured):
  ```bash
  cd infrastructure
  terraform init                      # uses the S3 backend configured above
  terraform plan -var-file=environments/dev.tfvars
  terraform apply -var-file=environments/dev.tfvars
  ```
- Artifacts: Terraform currently points Lambda functions to `modules/lambda/placeholder.zip`; replace this with a bundled artifact from `backend` (e.g., upload via CI before `apply`).
- Outputs (WebSocket URL, Cognito Pool ID, Client ID, CloudFront URL) feed the frontend `.env`.

### GitHub Actions
- Pipelines expect secrets: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, optional `SONAR_TOKEN`.
- Typical stages: install deps → lint → tests → Terraform plan/apply (on main).

## WebSocket API Contract

| Action | Payload | Response |
|--------|---------|----------|
| `$connect` | `?userId=<id>&username=<name>` | Registers connection with TTL |
| `$disconnect` | - | Removes connection |
| `sendMessage` | `{ content: string, roomId?: string }` | Broadcasts and returns `messageId` |
| `getMessages` | `{ roomId?: string, limit?: number }` | Emits `messageHistory` with `Message[]` |

```ts
interface Message {
  roomId: string;
  messageId: string;
  userId: string;
  username: string;
  content: string;
  createdAt: number; // epoch millis
}
```

## Troubleshooting
- Terraform init fails: ensure the remote state bucket/table exist or temporarily run with `-backend=false` for validation.
- WebSocket 403 locally: set `VITE_MOCK_AUTH=true` and use the Docker compose defaults.
- DynamoDB Local tests fail: confirm `docker compose up dynamodb-local` is running and `DYNAMODB_ENDPOINT` is set.

## License

MIT
