# Project Status (Local/Docker)

- Backend deps: updated to latest (@aws-sdk/client-* 3.971.0). Frontend deps: vue ^3.5.27, tailwindcss ^4.1.18.
- Validation (Docker): `make validate-all` passes (terraform validate, backend lint/tests, frontend lint/tests/typecheck/build).
- Lint: ESLint flat config for Vue/TS; no outstanding warnings.
- Tests: Backend unit+integration, Frontend unit (Vitest) all green in Docker.

## Required Environment
- Frontend `.env` (for local/dev builds and runtime):
  - `VITE_WEBSOCKET_URL=wss://<api-id>.execute-api.<region>.amazonaws.com/<stage>`
  - `VITE_COGNITO_USER_POOL_ID=<user-pool-id>`
  - `VITE_COGNITO_CLIENT_ID=<app-client-id>`
  - `VITE_AWS_REGION=<aws-region>` (e.g., eu-central-1)
- Backend (Lambda/Docker):
  - `CONNECTIONS_TABLE`, `MESSAGES_TABLE` (docker-compose sets defaults).
  - `AWS_REGION`, credentials for AWS if invoking real services.
  - `DYNAMODB_ENDPOINT` for local DynamoDB (set in docker-compose).

## Pending Setup
- Terraform remote state: enable S3/DynamoDB backend in `infrastructure/main.tf` after creating bucket/table.
- CI/CD secrets (GitHub Actions): `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `SONAR_TOKEN` (optional).
- Ensure repo is pushed to remote (GitHub/Bitbucket) for pipeline/deploy.
