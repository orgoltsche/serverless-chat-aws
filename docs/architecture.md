# Serverless Chat - Technical Documentation

## 1. Software Description

### Purpose
Serverless Chat is a real-time WebSocket chat application. Users authenticate, join chat rooms, send messages, and receive messages from other participants instantly.

### Problem Solved
Traditional chat systems require persistent server infrastructure with complex scaling logic. This application eliminates server management by using AWS serverless primitives that scale automatically and incur costs only during actual usage.

### Core Features
- Real-time bidirectional messaging via WebSocket
- User authentication (AWS Cognito)
- Room-based conversations (default: "global")
- Message history with pagination
- Automatic connection cleanup via TTL

---

## 2. Architecture Overview

### 2.1 Software Architecture

The system consists of three layers:

```
┌─────────────────────────────────────────────────────────────┐
│                      PRESENTATION                           │
│  Vue 3 SPA (TypeScript, Pinia, Tailwind CSS)               │
│  - UserLogin.vue: Authentication UI                        │
│  - ChatRoom.vue: Main chat interface                       │
│  - useWebSocket.ts: WebSocket lifecycle                    │
│  - useAuth.ts: Cognito integration                         │
└─────────────────────────────────────────────────────────────┘
                              │
                    HTTPS / WebSocket (wss://)
                              │
┌─────────────────────────────────────────────────────────────┐
│                      APPLICATION                            │
│  4 Lambda Functions (Node.js 20, TypeScript):              │
│  - connect: Registers new WebSocket connections            │
│  - disconnect: Removes connection on close                 │
│  - sendMessage: Persists message, broadcasts to clients    │
│  - getMessages: Retrieves room history                     │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                      DATA                                   │
│  DynamoDB Tables:                                          │
│  - connections: Active WebSocket connections (TTL-based)   │
│  - messages: Chat messages with room partitioning          │
└─────────────────────────────────────────────────────────────┘
```

**Data Flow:**
1. User authenticates via Cognito (or mock auth locally)
2. Frontend opens WebSocket with `userId` and `username` as query parameters
3. `connect` Lambda stores connection metadata with 24h TTL
4. User sends message → `sendMessage` Lambda saves to DynamoDB and broadcasts to all active connections
5. `getMessages` Lambda retrieves history sorted by timestamp
6. On disconnect, connection record is removed

### 2.2 AWS Architecture

| Component | AWS Service | Configuration |
|-----------|-------------|---------------|
| **Frontend Hosting** | S3 + CloudFront | OAC-protected bucket, HTTPS enforced, SPA routing |
| **WebSocket API** | API Gateway v2 | Routes: `$connect`, `$disconnect`, `sendMessage`, `getMessages` |
| **Compute** | Lambda | Node.js 20, 256MB RAM, 30s timeout, VPC-attached |
| **Data Storage** | DynamoDB | On-demand billing, TTL on connections table |
| **Authentication** | Cognito User Pool | Email-based registration, password policy enforced |
| **Networking** | VPC | 10.0.0.0/16, 2 AZs, public/private subnets, NAT Gateway |
| **Logs** | CloudWatch Logs | 14-day retention per Lambda |

**Infrastructure Diagram:**
```
                         Internet
                            │
              ┌─────────────┴─────────────┐
              │                           │
         CloudFront                 API Gateway
         (HTTPS)                   (WebSocket)
              │                           │
              ▼                           ▼
           S3 Bucket              Lambda Functions
         (Vue 3 SPA)             (Private Subnets)
                                          │
                              ┌───────────┴───────────┐
                              │                       │
                          DynamoDB                 Cognito
                    (connections, messages)     (User Pool)
```

**DynamoDB Schema:**

*connections table:*
| Attribute | Type | Purpose |
|-----------|------|---------|
| connectionId (PK) | String | WebSocket connection identifier |
| userId | String | Authenticated user ID |
| username | String | Display name |
| connectedAt | String | ISO timestamp |
| ttl | Number | Epoch seconds for auto-deletion |

*messages table:*
| Attribute | Type | Purpose |
|-----------|------|---------|
| roomId (PK) | String | Chat room identifier |
| sortKey (SK) | String | `timestamp#messageId` for ordering |
| messageId | String | UUID |
| userId | String | Author's user ID |
| username | String | Author's display name |
| content | String | Message text |
| createdAt | Number | Epoch milliseconds |

GSI `userId-index`: Enables querying messages by user.

---

## 3. Software Delivery Process (CI/CD)

The project uses GitHub Actions with three workflows:

### 3.1 Continuous Integration (`ci.yml`)

**Trigger:** Push to `main`/`develop`, Pull Requests to `main`

**Jobs:**

| Job | Steps |
|-----|-------|
| Backend Tests | npm install → ESLint → TypeScript check → Jest tests |
| Frontend Tests | npm install → ESLint → vue-tsc → Vitest → Vite build |
| Infrastructure | terraform fmt -check → terraform validate |
| Security | tfsec scan → npm audit (backend + frontend) |

### 3.2 Deployment (`deploy.yml`)

**Trigger:** Push to `main`, Manual dispatch

**Stages:**

```
Stage 1: Infrastructure
├── terraform init
├── terraform plan -var-file=environments/dev.tfvars
└── terraform apply -auto-approve
    Outputs: WebSocket URL, Cognito IDs, S3 bucket, CloudFront ID

Stage 2: Backend
├── npm ci && npm run build
├── Zip each Lambda handler
└── aws lambda update-function-code (4 functions)

Stage 3: Frontend
├── npm ci
├── Inject Terraform outputs as VITE_* env vars
├── npm run build
├── aws s3 sync dist/ s3://<bucket> --delete
└── aws cloudfront create-invalidation --paths "/*"
```

### 3.3 Destroy (`destroy.yml`)

**Trigger:** Manual dispatch only

Executes `terraform destroy -auto-approve` to remove all AWS resources.

### Required Secrets

| Secret | Purpose |
|--------|---------|
| `AWS_ACCESS_KEY_ID` | AWS authentication |
| `AWS_SECRET_ACCESS_KEY` | AWS authentication |
| `SONAR_TOKEN` | SonarCloud analysis (optional) |

### Terraform State

- Backend: S3 bucket `serverless-chat-terraform-state-eu-central-1`
- Lock table: DynamoDB `terraform-state-lock`
- Region: eu-central-1

---

## 4. Local Development

### Prerequisites

| Tool | Purpose |
|------|---------|
| Docker + Docker Compose | Container runtime |
| Make | Command shortcuts (optional) |
| Node.js 20+ | Only if running outside Docker |
| Terraform >= 1.6 | Infrastructure deployment |
| AWS CLI | Deployment and Lambda updates |

### Quick Start

```bash
# Build Docker images
make build

# Start development environment
make up
# Frontend: http://localhost:3000
# DynamoDB Local: http://localhost:8000

# Stop environment
make down
```

### Available Commands

| Command | Action |
|---------|--------|
| `make build` | Build all Docker images |
| `make up` | Start frontend + DynamoDB Local |
| `make down` | Stop all containers |
| `make test-backend` | Run Jest tests |
| `make test-frontend` | Run Vitest + build |
| `make lint-all` | ESLint for backend + frontend |
| `make validate-terraform` | Validate Terraform configuration |
| `make validate-all` | Full validation pipeline |

### Environment Variables

**Frontend (`frontend/.env`):**
```env
VITE_WEBSOCKET_URL=wss://<api-id>.execute-api.<region>.amazonaws.com/<stage>
VITE_COGNITO_USER_POOL_ID=<pool-id>
VITE_COGNITO_CLIENT_ID=<client-id>
VITE_AWS_REGION=eu-central-1
VITE_MOCK_AUTH=true   # Enables local authentication bypass
```

**Backend (via Docker Compose):**
```env
CONNECTIONS_TABLE=chat-connections
MESSAGES_TABLE=chat-messages
AWS_REGION=eu-central-1
DYNAMODB_ENDPOINT=http://dynamodb-local:8000
```

### Running Without Docker

```bash
# Backend
cd backend
npm install
npm run lint
npm run typecheck
npm test

# Frontend
cd frontend
npm install
npm run lint
npm run typecheck
npm test
npm run build
```

### Local Testing Strategy

| Layer | Tool | Command |
|-------|------|---------|
| Backend Unit | Jest | `npm run test:unit` |
| Backend Integration | Jest + DynamoDB Local | `npm run test:integration` |
| Frontend Unit | Vitest | `npm test` |
| Infrastructure | Terraform | `terraform validate` |

---

## Appendix: WebSocket API

| Route | Payload | Description |
|-------|---------|-------------|
| `$connect` | `?userId=<id>&username=<name>` | Registers connection |
| `$disconnect` | - | Removes connection |
| `sendMessage` | `{ action: "sendMessage", content: string, roomId?: string }` | Sends message |
| `getMessages` | `{ action: "getMessages", roomId?: string, limit?: number }` | Retrieves history |
