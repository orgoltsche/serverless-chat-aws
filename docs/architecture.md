# Architecture Documentation

## Overview

This document describes the technical architecture of the Serverless Chat application.

## System Architecture

```
                                    ┌─────────────────────────────────────────────────────────┐
                                    │                      AWS Cloud                          │
                                    │                                                         │
┌──────────┐                        │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│          │      HTTPS             │  │ CloudFront  │───▶│     S3      │    │  Cognito    │ │
│  Browser │───────────────────────▶│  │   (CDN)     │    │  (Static)   │    │ User Pool   │ │
│          │                        │  └─────────────┘    └─────────────┘    └──────┬──────┘ │
└────┬─────┘                        │                                               │        │
     │                              │                                               │        │
     │ WebSocket (wss://)           │  ┌─────────────────────────────────────┐     │        │
     │                              │  │              VPC                     │     │        │
     └─────────────────────────────▶│  │  ┌─────────────────────────────┐    │     │        │
                                    │  │  │      Private Subnet          │    │     │        │
                                    │  │  │                              │    │     │        │
┌─────────────┐                     │  │  │  ┌────────────────────────┐ │    │     │        │
│ API Gateway │─────────────────────│──│──│─▶│    Lambda Functions    │─│────│─────┘        │
│ (WebSocket) │                     │  │  │  │                        │ │    │              │
└─────────────┘                     │  │  │  │  - onConnect           │ │    │              │
                                    │  │  │  │  - onDisconnect        │ │    │              │
                                    │  │  │  │  - sendMessage         │ │    │              │
                                    │  │  │  │  - getMessages         │ │    │              │
                                    │  │  │  └───────────┬────────────┘ │    │              │
                                    │  │  │              │              │    │              │
                                    │  │  └──────────────│──────────────┘    │              │
                                    │  │                 │                   │              │
                                    │  │  ┌──────────────┘                   │              │
                                    │  │  │  NAT Gateway                     │              │
                                    │  │  │                                  │              │
                                    │  └──│──────────────────────────────────┘              │
                                    │     │                                                 │
                                    │     ▼                                                 │
                                    │  ┌─────────────┐                                      │
                                    │  │  DynamoDB   │                                      │
                                    │  │  - Connections                                     │
                                    │  │  - Messages │                                      │
                                    │  └─────────────┘                                      │
                                    └─────────────────────────────────────────────────────────┘
```

## Component Details

### 1. Frontend (Vue.js)

**Technology:** Vue 3, TypeScript, Tailwind CSS, Pinia

**Structure:**
```
frontend/src/
├── components/
│   ├── ChatRoom.vue      # Main chat container
│   ├── MessageList.vue   # Message list with auto-scroll
│   ├── MessageInput.vue  # Input field for messages
│   └── UserLogin.vue     # Login/registration form
├── composables/
│   ├── useAuth.ts        # Cognito authentication
│   └── useWebSocket.ts   # WebSocket connection management
└── stores/
    └── chat.ts           # Pinia store for chat state
```

**Data Flow:**
1. User logs in via Cognito
2. After login: WebSocket connection established with user ID
3. Messages sent/received via WebSocket
4. State management via Pinia store

### 2. API Gateway (WebSocket)

**Routes:**
| Route | Lambda | Description |
|-------|--------|-------------|
| `$connect` | connect | Establish connection, save to DB |
| `$disconnect` | disconnect | Close connection, remove from DB |
| `sendMessage` | sendMessage | Broadcast message to all clients |
| `getMessages` | getMessages | Retrieve message history |

**Authentication:**
- Connection via query parameters: `?userId=xxx&username=xxx`
- Cognito token validation possible (optionally implemented)

### 3. Lambda Functions

**Runtime:** Node.js 20.x
**Language:** TypeScript
**Bundling:** esbuild

#### connect.ts
```
Input:  WebSocket $connect event
        Query params: userId, username
Action: Save connection to DynamoDB
Output: 200 OK / 500 Error
```

#### disconnect.ts
```
Input:  WebSocket $disconnect event
Action: Delete connection from DynamoDB
Output: 200 OK / 500 Error
```

#### sendMessage.ts
```
Input:  { action: "sendMessage", data: { content, roomId? } }
Action: 1. Save message to DynamoDB
        2. Broadcast to all connections
Output: { success: true, messageId } / Error
```

#### getMessages.ts
```
Input:  { action: "getMessages", data: { roomId?, limit? } }
Action: Query messages from DynamoDB
Output: Message[] via WebSocket to client
```

### 4. DynamoDB Tables

#### Connections Table
```
Primary Key: connectionId (String)

Attributes:
- connectionId: String  (PK)
- userId: String
- username: String
- connectedAt: Number
- ttl: Number (24h expiry)
```

**Access Patterns:**
- Get connection by ID
- Scan all connections (for broadcast)
- Auto-delete via TTL

#### Messages Table
```
Primary Key: roomId (String)
Sort Key: sortKey (String) = "timestamp#messageId"

Attributes:
- roomId: String (PK)
- sortKey: String (SK)
- messageId: String
- userId: String
- username: String
- content: String
- createdAt: Number

GSI: userId-index (for user history)
```

**Access Patterns:**
- Query messages by room (sorted by time)
- Query messages by user (via GSI)

### 5. Cognito User Pool

**Configuration:**
- Username: Email
- Verification: Email
- Password: Min. 8 characters, uppercase, lowercase, numbers

**Attributes:**
- email (required)
- nickname (optional)

**Auth Flows:**
- USER_PASSWORD_AUTH
- USER_SRP_AUTH
- REFRESH_TOKEN_AUTH

### 6. Frontend Hosting (S3 + CloudFront)

**S3 Bucket:**
- Private (no public access)
- Versioning enabled
- Origin Access Control for CloudFront

**CloudFront:**
- HTTPS only
- Gzip compression
- SPA routing (404 → index.html)
- Price Class: 100 (cheapest)

## Network Architecture

### VPC Layout
```
VPC: 10.0.0.0/16

├── Public Subnet A:  10.0.0.0/24  (eu-central-1a)
│   └── NAT Gateway
│
├── Public Subnet B:  10.0.1.0/24  (eu-central-1b)
│
├── Private Subnet A: 10.0.10.0/24 (eu-central-1a)
│   └── Lambda Functions
│
└── Private Subnet B: 10.0.11.0/24 (eu-central-1b)
    └── Lambda Functions
```

**Routing:**
- Public subnets → Internet Gateway
- Private subnets → NAT Gateway → Internet

**Why VPC for Lambda?**
- Better isolation
- Future-proof for RDS/ElastiCache
- Compliance requirements

## Security

### IAM Permissions

**Lambda Role:**
```json
{
  "Effect": "Allow",
  "Action": [
    "dynamodb:GetItem",
    "dynamodb:PutItem",
    "dynamodb:DeleteItem",
    "dynamodb:Query",
    "dynamodb:Scan"
  ],
  "Resource": [
    "arn:aws:dynamodb:*:*:table/connections",
    "arn:aws:dynamodb:*:*:table/messages"
  ]
}
```

### Security Measures

1. **S3:** Private bucket, CloudFront access only
2. **Lambda:** VPC-isolated, minimal IAM permissions
3. **DynamoDB:** Encryption at rest
4. **CloudFront:** HTTPS only
5. **Cognito:** Password policy, email verification

## Scalability

| Component | Scaling |
|-----------|---------|
| API Gateway | Automatic (up to 10,000 connections default) |
| Lambda | Automatic (1000 concurrent default) |
| DynamoDB | On-demand (pay per request) |
| CloudFront | Global edge network |
| S3 | Unlimited |

### Known Limits

- **WebSocket Connections:** 500 per account (increasable)
- **Lambda Concurrent:** 1000 (increasable)
- **DynamoDB Item Size:** 400 KB max
- **Message Broadcast:** At >100 connections, Lambda timeout may occur

## Cost Estimate (Dev Environment)

| Service | Estimated Cost/Month |
|---------|---------------------|
| Lambda | ~$0 (Free Tier: 1M requests) |
| API Gateway | ~$1-5 |
| DynamoDB | ~$0 (on-demand, minimal) |
| S3 | ~$0.03 |
| CloudFront | ~$0-1 |
| NAT Gateway | ~$35 (largest cost factor!) |
| **Total** | **~$35-45** |

**Note:** NAT Gateway is the largest cost factor. For production, consider VPC Endpoints for DynamoDB.

## Extension Possibilities

1. **Private Rooms:** roomId already implemented, UI missing
2. **Message History Pagination:** Cursor-based pagination
3. **Typing Indicators:** New WebSocket event
4. **File Sharing:** S3 pre-signed URLs
5. **Push Notifications:** SNS integration
6. **Rate Limiting:** API Gateway throttling
