**Folienset-Vorschlag (15 Min, technisch fokussiert)**

- **1. Projektüberblick**
  - Was: Serverless WebSocket-Chat (Vue 3 SPA + AWS Lambda)
  - Warum: Skalierung ohne Serverbetrieb, Pay-per-use
  - Repos: `frontend/`, `backend/`, `infrastructure/`, `docs/`, `.github/`
  - Hinweis mündlich: Scope (Demo-tauglich, kein Multimediaversand)

- **2. Funktionaler Ablauf**
  - Auth via Cognito (lokal optional Mock per `VITE_MOCK_AUTH`)
  - WebSocket-Fluss: `$connect` → Nachrichten senden/empfangen → `$disconnect`
  - Räume: Default `global`, History via `getMessages`
  - Mündlich: TTL/Offline-Handhabung (24h Auto-Cleanup)

- **3. Frontend-Architektur (Vue 3 + Vite)**
  - State: Pinia-Store `stores/chat.ts`; Composables `useAuth`, `useWebSocket`
  - UI: `UserLogin`, `ChatRoom`, `MessageList`, `MessageInput`
  - Styling: Tailwind, SPA auf S3/CloudFront, SPA-Routing
  - Prüfungsfrage-Fokus: Fehlerfallbehandlung (WebSocket reconnect/backoff?)

- **4. Backend-Architektur (Lambda, Node 20, TypeScript)**
  - Handler: `connect`, `disconnect`, `sendMessage`, `getMessages`
  - Services: `dynamodb.ts` (CRUD, Scan für Broadcast), `websocket.ts` (APIGW callbacks)
  - Datenmodell: DynamoDB `connections` (TTL), `messages` (PK roomId, SK timestamp#id, GSI userId)
  - Risiken: Scan für Broadcast skaliert schlecht >~1k Verbindungen (Paging/SNS/SQS als Alternative)

- **5. AWS-Infrastruktur (Terraform)**
  - Module: VPC (2 AZ, private Subnets, NAT), DynamoDB, Cognito, Lambda, API Gateway v2 (WebSocket), Frontend-Hosting (S3+CloudFront)
  - State: Remote S3 + DynamoDB Lock (eu-central-1)
  - Security: OAC für S3, Cognito-Authorizer an APIGW-Routen (implizit, Annahme falls noch nicht hinterlegt)
  - Prüfungsfragen: VPC ↔ Lambda Kosten (NAT), Least-Privilege IAM für Lambda ↔ DynamoDB

- **6. CI/CD-Pipeline (GitHub Actions)**
  - CI: Lint/Typecheck/Test (Backend: Jest+Coverage; Frontend: Vitest+Build), Terraform fmt/validate, tfsec + npm audit, Sonar optional
  - Deploy (main): Terraform init/plan/apply dev tfvars → Build/zip Lambdas → `update-function-code` → Frontend Build + `aws s3 sync` + CloudFront Invalidation
  - Destroy: Manueller Workflow
  - Prüfungsfragen: Rollback-Strategie? Artefakt-Versionierung der Lambda-Zips?

- **7. Lokale Entwicklung & Tests**
  - `make build|up|down`; Docker Compose inkl. DynamoDB Local
  - Backend cmds: `npm run lint|typecheck|test`; Frontend: `npm run lint|typecheck|test|build`
  - Umgebungsvariablen (.env Beispiele in Doku)
  - Lücken: Keine E2E- oder Load-Tests definiert (klar kennzeichnen)

- **8. Qualitäts- & Sicherheitsaspekte**
  - Lint/Typechecks im CI; tfsec Soft-Fail; npm audit high
  - Logging/Tracing: CloudWatch default, kein strukturiertes JSON/Tracing (Annahme)
  - Datenschutz: Chat-Inhalte in DynamoDB ohne Verschlüsselungs-Hinweis (default-at-rest via AWS, Annahme)
  - Prüfungsfragen: Multi-tenant-Isolation? Rate-Limits / WAF vor WebSocket?

- **9. Betriebsaspekte**
  - Skalierung: APIGW WebSocket + Lambda auto; DynamoDB On-Demand
  - Kosten-Treiber: NAT Gateway (dauerhaft), CloudFront Traffic, DynamoDB Schreiblast
  - Observability-Gap: Keine Metrics/Alarms in Terraform (Fehlstelle erwähnen)

- **10. Live-Demo (1–3 Min)**
  - Zeigen: Login (Mock), Eintritt in Raum „global“, zwei Browser-Tabs: Nachricht senden, Empfang in Echtzeit, History-Load nach Reload.
  - Sinn: Belegt End-to-End-Fluss (Auth → WS → Persistence → Broadcast)
  - Vorbereitung: `make up`, Frontend auf `http://localhost:3000`, sicherstellen, dass DynamoDB Local läuft.
  - Fallback: Postman/WebSocket-Client gegen lokales APIGW-Mock mit `sendMessage` Payload.

- **11. Risiken & Verbesserungen (Q&A-Anker)**
  - Broadcast via Scan: ersetzen durch connection partitioning + Fan-out (SNS/SQS) bei hoher Userzahl.
  - Reconnect/Backoff + Offline-Queue im Frontend.
  - Add CloudWatch Alarms + Structured Logs + Tracing (X-Ray).
  - IAM Least-Privilege Review für Lambdas; Secrets (Cognito IDs) per SSM/Secrets Manager statt env.
  - Add Load/E2E-Tests; Canary Deploy für Lambdas.

**Mündliche Hinweise pro Folie**
- Kurz den Datenfluss skizzieren (Whiteboard 30 s bei Folie 2/4).
- CI/CD: betonen, dass Infra zuerst, dann Code, dann SPA; warum CloudFront Invalidation nötig.
- Infra: klarstellen, dass WebSocket-Authorizer auf Cognito liegt (falls noch nicht verdrahtet, als To-Do markieren).
- Bei Risiken offen benennen, welche Schritte priorisiert würden (Broadcast-Skalierung, Observability).

**Plausible Annahmen (kennzeichnen)**
- Cognito als Authorizer an APIGW-Routen aktiv (falls nicht im Code ersichtlich).
- CloudWatch Logs retention 14 Tage wie in Doku; keine zusätzliche Alarmierung.
- Keine End-to-End-Tests / Load-Tests vorhanden.

**Fragen, die Prüfer wahrscheinlich stellen**
- Wie wird Skalierung des Broadcasts gelöst, wenn Scan nicht reicht?
- Was passiert bei Token-Expiry/Logout mit offenen Verbindungen?
- Kostenoptimierung: Warum NAT Gateway notwendig, Alternativen (VPC Endpoints)?
- Datenkonsistenz/Reihenfolge: Garantien bei DynamoDB + WebSocket Broadcast?
- Sicherheitsmodell: Schutz vor unerlaubtem Publish (Cognito, IAM, WAF/Rate Limit).
