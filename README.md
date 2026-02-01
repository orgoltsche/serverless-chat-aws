# Serverless Chat Application

Real-time WebSocket chat on AWS serverless infrastructure with Vue 3 frontend.

## Documentation

| Document | Description |
|----------|-------------|
| [docs/architecture.md](docs/architecture.md) | Technical documentation (EN) |
| [docs/architecture_de.md](docs/architecture_de.md) | Technische Dokumentation (DE) |

## Quick Start

```bash
make build   # Build Docker images
make up      # Start dev server (http://localhost:3000)
make down    # Stop containers
```

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vue 3, TypeScript, Vite, Tailwind CSS |
| Backend | AWS Lambda (Node.js 20), API Gateway WebSocket |
| Data | DynamoDB (connections, messages) |
| Auth | AWS Cognito |
| Hosting | S3, CloudFront |
| IaC | Terraform |
| CI/CD | GitHub Actions |

## Repository Structure

```
├── backend/         # Lambda functions (TypeScript)
├── frontend/        # Vue 3 SPA
├── infrastructure/  # Terraform modules
├── docs/            # Documentation
└── .github/         # CI/CD workflows
```

## License

MIT
