# Architecture

System design for the Serverless Chat application (WebSocket chat with Cognito-authenticated users).

```
Browser (Vue) ── HTTPS ──► CloudFront ──► S3 (SPA hosting)
          │
          └─ wss:// ──► API Gateway (WebSocket)
                             │
                             ▼
                        Lambda (connect, disconnect, sendMessage, getMessages)
                             │
                             ▼
                         DynamoDB (connections, messages + GSI userId)
                             │
                             ▼
                          Cognito (user pool)
```

## Flow
1. User signs in with Cognito (local dev can mock auth).
2. Frontend opens a WebSocket: `wss://<id>.execute-api.<region>.amazonaws.com/<stage>?userId&username`.
3. `$connect` stores connection with TTL in DynamoDB.
4. `sendMessage` writes to `messages` and uses `execute-api:ManageConnections` to push to all active connections.
5. `getMessages` queries history (room-based, sorted by `createdAt`/`messageId`) and returns `messageHistory`.
6. `$disconnect` removes the connection record.

## Components

### Frontend
- Vue 3 + TypeScript + Vite + Tailwind, Pinia store for chat state.
- WebSocket client in `useWebSocket.ts`; authentication helper in `useAuth.ts` (Cognito or mocked).
- SPA hosted on CloudFront with OAC-protected S3 origin.

### WebSocket API (API Gateway v2)
- Routes: `$connect`, `$disconnect`, `sendMessage`, `getMessages`.
- Route selection: `$request.body.action`.
- Stage: `dev` by default; throttling burst/rate: `500/1000`.

### Lambda Functions (Node.js 20, TypeScript)
- `connect`: persists `connectionId`, `userId`, `username`, `connectedAt`, `ttl`.
- `disconnect`: deletes connection.
- `sendMessage`: writes message item, broadcasts to all active connections.
- `getMessages`: queries by `roomId` with optional `limit`; supports GSI query by `userId`.
- IAM policy: DynamoDB CRUD on the two tables (+ GSI), `execute-api:ManageConnections`, CloudWatch Logs, VPC ENI management.
- Networking: runs inside private subnets; outbound via NAT Gateway.

### Data Layer (DynamoDB)
- Tables are named `${project}-${env}-connections` and `${project}-${env}-messages`.
- `connections`: PK `connectionId` (TTL on `ttl`).
- `messages`: PK `roomId`, SK `sortKey` = `timestamp#messageId`; GSI `userId-index` on `userId + sortKey`.

### Identity
- Cognito User Pool (email/username), app client without secret for SPA.
- Password policy: ≥8 chars, uppercase, lowercase, numbers (see module defaults).
- Local dev: `VITE_MOCK_AUTH=true` bypasses Cognito.

### Networking & Delivery
- VPC `10.0.0.0/16` dual-stack (IPv4 + generated IPv6) with two public + two private subnets (first two AZs).
- Internet Gateway (IPv4/IPv6) + NAT Gateway (IPv4) + Egress-Only IGW (IPv6) for Lambda egress.
- CloudFront enforces HTTPS; SPA routing supported (index fallback).

## Observability & Ops
- CloudWatch Log Groups per Lambda with 14-day retention.
- Health check for DynamoDB Local in Docker.
- Terraform outputs: WebSocket endpoint, Cognito Pool ID, Client ID, CloudFront URL, S3 bucket.

## Scaling & Limits
- API Gateway WebSocket: auto-scales (account-level connection limits apply).
- Lambda: AWS defaults (1,000 concurrent unless raised); 256 MB, 30s timeout.
- DynamoDB: on-demand capacity; 400 KB item limit.
- At high fan-out (>100 connections) broadcasting from a single Lambda may need batching/back-pressure.

## Cost Notes
- Main fixed cost in dev: NAT Gateway (~$35/mo). Everything else is pay-per-request and typically negligible for demos.
- For cost-sensitive dev, consider temporarily removing VPC/NAT or using VPC endpoints for DynamoDB.
