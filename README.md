# Serverless Chat Application

A real-time chat application built on AWS serverless architecture with WebSocket support.

## Project Overview

| Aspect | Details |
|--------|---------|
| **Frontend** | Vue 3 + TypeScript + Tailwind CSS |
| **Backend** | AWS Lambda (Node.js 20) + TypeScript |
| **Database** | Amazon DynamoDB |
| **Auth** | Amazon Cognito |
| **API** | API Gateway WebSocket |
| **Hosting** | S3 + CloudFront |
| **IaC** | Terraform |
| **CI/CD** | GitHub Actions |

## Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│   Browser   │────▶│  CloudFront     │────▶│     S3      │
│  (Vue.js)   │     │  (CDN)          │     │  (Static)   │
└──────┬──────┘     └─────────────────┘     └─────────────┘
       │
       │ WebSocket
       ▼
┌─────────────────┐     ┌─────────────┐     ┌─────────────┐
│  API Gateway    │────▶│   Lambda    │────▶│  DynamoDB   │
│  (WebSocket)    │     │  Functions  │     │  Tables     │
└─────────────────┘     └──────┬──────┘     └─────────────┘
                               │
                        ┌──────┴──────┐
                        │   Cognito   │
                        │  User Pool  │
                        └─────────────┘
```

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Make (optional, simplifies commands)
- AWS CLI (for deployment)
- Terraform >= 1.6

### Local Development with Docker

```bash
# Build all containers
make build

# Run backend tests
make test-backend

# Run frontend tests
make test-frontend

# Validate Terraform
make validate-terraform

# Run all validations (tests + lint + Terraform)
make validate-all

# Start frontend dev server (http://localhost:3000)
make up
```

### Without Make

```bash
# Build containers
docker compose build

# Backend tests
docker compose run --rm backend npm test

# Frontend build
docker compose run --rm frontend npm run build

# Terraform validation
docker compose run --rm terraform
```

## Project Structure

```
.
├── backend/                 # Lambda Functions (TypeScript)
│   ├── src/
│   │   ├── handlers/        # Lambda handlers (connect, disconnect, etc.)
│   │   ├── services/        # DynamoDB & WebSocket services
│   │   └── types/           # TypeScript interfaces
│   └── tests/
│       ├── unit/            # Unit tests
│       └── integration/     # Integration tests (local DynamoDB)
│
├── frontend/                # Vue.js Application
│   ├── src/
│   │   ├── components/      # Vue components
│   │   ├── composables/     # Vue composables (useAuth, useWebSocket)
│   │   └── stores/          # Pinia stores
│   └── tests/
│
├── infrastructure/          # Terraform IaC
│   ├── modules/
│   │   ├── vpc/             # VPC with public/private subnets
│   │   ├── dynamodb/        # DynamoDB tables
│   │   ├── cognito/         # Cognito User Pool
│   │   ├── lambda/          # Lambda functions
│   │   ├── api-gateway/     # WebSocket API
│   │   └── frontend-hosting/# S3 + CloudFront
│   └── environments/
│       ├── dev.tfvars
│       └── prod.tfvars
│
├── .github/workflows/       # CI/CD Pipelines
│   ├── ci.yml               # Tests, lint, security scan
│   └── deploy.yml           # Terraform apply + deploy
│
├── docker-compose.yml       # Docker setup for local development
├── Makefile                 # Simplified commands
└── docs/                    # Documentation
```

## AWS Services

| Service | Purpose |
|---------|---------|
| **API Gateway** | WebSocket API for real-time communication |
| **Lambda** | 4 functions: connect, disconnect, sendMessage, getMessages |
| **DynamoDB** | 2 tables: Connections, Messages |
| **Cognito** | User authentication (email + password) |
| **S3** | Static website hosting |
| **CloudFront** | CDN for frontend |
| **VPC** | Network isolation for Lambda |

## Deployment

### 1. Configure AWS Credentials

```bash
aws configure
# Or set environment variables:
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export AWS_REGION=eu-central-1
```

### 2. Create Terraform State Backend (one-time)

```bash
# S3 bucket for Terraform state
aws s3 mb s3://your-project-terraform-state --region eu-central-1

# DynamoDB table for state locking
aws dynamodb create-table \
  --table-name terraform-state-lock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

### 3. Enable Terraform Backend in main.tf

```hcl
backend "s3" {
  bucket         = "your-project-terraform-state"
  key            = "terraform.tfstate"
  region         = "eu-central-1"
  encrypt        = true
  dynamodb_table = "terraform-state-lock"
}
```

### 4. Deploy Infrastructure

```bash
cd infrastructure
terraform init
terraform plan -var-file=environments/dev.tfvars
terraform apply -var-file=environments/dev.tfvars
```

### 5. Set GitHub Actions Secrets

For automatic deployment via CI/CD:

| Secret | Description |
|--------|-------------|
| `AWS_ACCESS_KEY_ID` | AWS Access Key |
| `AWS_SECRET_ACCESS_KEY` | AWS Secret Key |
| `SONAR_TOKEN` | SonarCloud Token (optional) |

## Testing

### Test Strategy

| Phase | Tool | Description |
|-------|------|-------------|
| **Unit Tests** | Jest / Vitest | Isolated function logic |
| **Integration Tests** | Jest + DynamoDB Local | DynamoDB operations |
| **Static Analysis** | ESLint + tfsec | Code quality + security |
| **Security Scan** | npm audit, tfsec | Dependency & IaC security |

### Running Tests

```bash
# All tests
make test-all

# Backend only
make test-backend

# With coverage
make test-backend-coverage

# Integration tests (requires DynamoDB Local)
docker compose up -d dynamodb-local
docker compose run --rm backend npm run test:integration
```

## API Reference

### WebSocket Events

#### Client → Server

| Action | Payload | Description |
|--------|---------|-------------|
| `sendMessage` | `{ content: string, roomId?: string }` | Send a message |
| `getMessages` | `{ roomId?: string, limit?: number }` | Retrieve message history |

#### Server → Client

| Type | Payload | Description |
|------|---------|-------------|
| `newMessage` | `Message` | New message received |
| `messageHistory` | `Message[]` | Message history response |

### Message Format

```typescript
interface Message {
  roomId: string;
  messageId: string;
  userId: string;
  username: string;
  content: string;
  createdAt: number;
}
```

## Environment Variables

### Frontend (.env)

```env
VITE_WEBSOCKET_URL=wss://xxx.execute-api.eu-central-1.amazonaws.com/dev
VITE_COGNITO_USER_POOL_ID=eu-central-1_xxxxxxxx
VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_AWS_REGION=eu-central-1
```

### Backend (Lambda Environment)

| Variable | Description |
|----------|-------------|
| `CONNECTIONS_TABLE` | DynamoDB Connections table name |
| `MESSAGES_TABLE` | DynamoDB Messages table name |

## License

MIT
