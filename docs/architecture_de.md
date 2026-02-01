# Serverless Chat - Technische Dokumentation

## 1. Softwarebeschreibung

### Zweck
Serverless Chat ist eine Echtzeit-WebSocket-Chat-Anwendung. Benutzer authentifizieren sich, treten Chaträumen bei, senden Nachrichten und empfangen Nachrichten anderer Teilnehmer in Echtzeit.

### Gelöstes Problem
Traditionelle Chat-Systeme erfordern persistente Server-Infrastruktur mit komplexer Skalierungslogik. Diese Anwendung eliminiert Serververwaltung durch den Einsatz von AWS Serverless-Komponenten, die automatisch skalieren und Kosten nur bei tatsächlicher Nutzung verursachen.

### Kernfunktionen
- Bidirektionale Echtzeit-Kommunikation via WebSocket
- Benutzerauthentifizierung (AWS Cognito)
- Raumbasierte Konversationen (Standard: "global")
- Nachrichtenverlauf mit Paginierung
- Automatische Verbindungsbereinigung via TTL

---

## 2. Architekturübersicht

### 2.1 Softwarearchitektur

Das System besteht aus drei Schichten:

```
┌─────────────────────────────────────────────────────────────┐
│                      PRÄSENTATION                           │
│  Vue 3 SPA (TypeScript, Pinia, Tailwind CSS)               │
│  - UserLogin.vue: Authentifizierungs-UI                    │
│  - ChatRoom.vue: Haupt-Chat-Oberfläche                     │
│  - useWebSocket.ts: WebSocket-Lebenszyklus                 │
│  - useAuth.ts: Cognito-Integration                         │
└─────────────────────────────────────────────────────────────┘
                              │
                    HTTPS / WebSocket (wss://)
                              │
┌─────────────────────────────────────────────────────────────┐
│                      ANWENDUNG                              │
│  4 Lambda-Funktionen (Node.js 20, TypeScript):             │
│  - connect: Registriert neue WebSocket-Verbindungen        │
│  - disconnect: Entfernt Verbindung bei Schließung          │
│  - sendMessage: Speichert Nachricht, sendet an Clients     │
│  - getMessages: Ruft Raumverlauf ab                        │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                      DATEN                                  │
│  DynamoDB-Tabellen:                                        │
│  - connections: Aktive WebSocket-Verbindungen (TTL-basiert)│
│  - messages: Chat-Nachrichten mit Raum-Partitionierung     │
└─────────────────────────────────────────────────────────────┘
```

**Datenfluss:**
1. Benutzer authentifiziert sich via Cognito (oder Mock-Auth lokal)
2. Frontend öffnet WebSocket mit `userId` und `username` als Query-Parameter
3. `connect`-Lambda speichert Verbindungsmetadaten mit 24h TTL
4. Benutzer sendet Nachricht → `sendMessage`-Lambda speichert in DynamoDB und sendet an alle aktiven Verbindungen
5. `getMessages`-Lambda ruft Verlauf sortiert nach Zeitstempel ab
6. Bei Trennung wird der Verbindungseintrag entfernt

### 2.2 AWS-Architektur

| Komponente | AWS-Service | Konfiguration |
|------------|-------------|---------------|
| **Frontend-Hosting** | S3 + CloudFront | OAC-geschützter Bucket, HTTPS erzwungen, SPA-Routing |
| **WebSocket-API** | API Gateway v2 | Routen: `$connect`, `$disconnect`, `sendMessage`, `getMessages` |
| **Compute** | Lambda | Node.js 20, 256MB RAM, 30s Timeout, VPC-angebunden |
| **Datenspeicherung** | DynamoDB | On-Demand-Abrechnung, TTL auf connections-Tabelle |
| **Authentifizierung** | Cognito User Pool | E-Mail-basierte Registrierung, Passwortrichtlinie erzwungen |
| **Netzwerk** | VPC | 10.0.0.0/16, 2 AZs, öffentliche/private Subnetze, NAT Gateway |
| **Logs** | CloudWatch Logs | 14 Tage Aufbewahrung pro Lambda |

**Infrastruktur-Diagramm:**
```
                         Internet
                            │
              ┌─────────────┴─────────────┐
              │                           │
         CloudFront                 API Gateway
         (HTTPS)                   (WebSocket)
              │                           │
              ▼                           ▼
           S3 Bucket              Lambda-Funktionen
         (Vue 3 SPA)             (Private Subnetze)
                                          │
                              ┌───────────┴───────────┐
                              │                       │
                          DynamoDB                 Cognito
                    (connections, messages)     (User Pool)
```

**DynamoDB-Schema:**

*connections-Tabelle:*
| Attribut | Typ | Zweck |
|----------|-----|-------|
| connectionId (PK) | String | WebSocket-Verbindungskennung |
| userId | String | Authentifizierte Benutzer-ID |
| username | String | Anzeigename |
| connectedAt | String | ISO-Zeitstempel |
| ttl | Number | Epoch-Sekunden für automatische Löschung |

*messages-Tabelle:*
| Attribut | Typ | Zweck |
|----------|-----|-------|
| roomId (PK) | String | Chatraum-Kennung |
| sortKey (SK) | String | `timestamp#messageId` für Sortierung |
| messageId | String | UUID |
| userId | String | Benutzer-ID des Autors |
| username | String | Anzeigename des Autors |
| content | String | Nachrichtentext |
| createdAt | Number | Epoch-Millisekunden |

GSI `userId-index`: Ermöglicht Abfrage von Nachrichten nach Benutzer.

---

## 3. Software-Delivery-Prozess (CI/CD)

Das Projekt verwendet GitHub Actions mit drei Workflows:

### 3.1 Continuous Integration (`ci.yml`)

**Auslöser:** Push auf `main`/`develop`, Pull Requests auf `main`

**Jobs:**

| Job | Schritte |
|-----|----------|
| Backend-Tests | npm install → ESLint → TypeScript-Prüfung → Jest-Tests |
| Frontend-Tests | npm install → ESLint → vue-tsc → Vitest → Vite-Build |
| Infrastruktur | terraform fmt -check → terraform validate |
| Sicherheit | tfsec-Scan → npm audit (Backend + Frontend) |

### 3.2 Deployment (`deploy.yml`)

**Auslöser:** Push auf `main`, Manueller Dispatch

**Phasen:**

```
Phase 1: Infrastruktur
├── terraform init
├── terraform plan -var-file=environments/dev.tfvars
└── terraform apply -auto-approve
    Outputs: WebSocket-URL, Cognito-IDs, S3-Bucket, CloudFront-ID

Phase 2: Backend
├── npm ci && npm run build
├── Jede Lambda-Funktion als ZIP verpacken
└── aws lambda update-function-code (4 Funktionen)

Phase 3: Frontend
├── npm ci
├── Terraform-Outputs als VITE_*-Umgebungsvariablen injizieren
├── npm run build
├── aws s3 sync dist/ s3://<bucket> --delete
└── aws cloudfront create-invalidation --paths "/*"
```

### 3.3 Destroy (`destroy.yml`)

**Auslöser:** Nur manueller Dispatch

Führt `terraform destroy -auto-approve` aus, um alle AWS-Ressourcen zu entfernen.

### Erforderliche Secrets

| Secret | Zweck |
|--------|-------|
| `AWS_ACCESS_KEY_ID` | AWS-Authentifizierung |
| `AWS_SECRET_ACCESS_KEY` | AWS-Authentifizierung |
| `SONAR_TOKEN` | SonarCloud-Analyse (optional) |

### Terraform-State

- Backend: S3-Bucket `serverless-chat-terraform-state-eu-central-1`
- Lock-Tabelle: DynamoDB `terraform-state-lock`
- Region: eu-central-1

---

## 4. Lokale Entwicklung

### Voraussetzungen

| Werkzeug | Zweck |
|----------|-------|
| Docker + Docker Compose | Container-Laufzeitumgebung |
| Make | Befehlskürzel (optional) |
| Node.js 20+ | Nur wenn außerhalb von Docker ausgeführt |
| Terraform >= 1.6 | Infrastruktur-Deployment |
| AWS CLI | Deployment und Lambda-Updates |

### Schnellstart

```bash
# Docker-Images bauen
make build

# Entwicklungsumgebung starten
make up
# Frontend: http://localhost:3000
# DynamoDB Local: http://localhost:8000

# Umgebung stoppen
make down
```

### Verfügbare Befehle

| Befehl | Aktion |
|--------|--------|
| `make build` | Alle Docker-Images bauen |
| `make up` | Frontend + DynamoDB Local starten |
| `make down` | Alle Container stoppen |
| `make test-backend` | Jest-Tests ausführen |
| `make test-frontend` | Vitest + Build ausführen |
| `make lint-all` | ESLint für Backend + Frontend |
| `make validate-terraform` | Terraform-Konfiguration validieren |
| `make validate-all` | Vollständige Validierungs-Pipeline |

### Umgebungsvariablen

**Frontend (`frontend/.env`):**
```env
VITE_WEBSOCKET_URL=wss://<api-id>.execute-api.<region>.amazonaws.com/<stage>
VITE_COGNITO_USER_POOL_ID=<pool-id>
VITE_COGNITO_CLIENT_ID=<client-id>
VITE_AWS_REGION=eu-central-1
VITE_MOCK_AUTH=true   # Aktiviert lokale Authentifizierungsumgehung
```

**Backend (via Docker Compose):**
```env
CONNECTIONS_TABLE=chat-connections
MESSAGES_TABLE=chat-messages
AWS_REGION=eu-central-1
DYNAMODB_ENDPOINT=http://dynamodb-local:8000
```

### Ausführung ohne Docker

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

### Lokale Teststrategie

| Schicht | Werkzeug | Befehl |
|---------|----------|--------|
| Backend Unit | Jest | `npm run test:unit` |
| Backend Integration | Jest + DynamoDB Local | `npm run test:integration` |
| Frontend Unit | Vitest | `npm test` |
| Infrastruktur | Terraform | `terraform validate` |

---

## Anhang: WebSocket-API

| Route | Payload | Beschreibung |
|-------|---------|--------------|
| `$connect` | `?userId=<id>&username=<name>` | Registriert Verbindung |
| `$disconnect` | - | Entfernt Verbindung |
| `sendMessage` | `{ action: "sendMessage", content: string, roomId?: string }` | Sendet Nachricht |
| `getMessages` | `{ action: "getMessages", roomId?: string, limit?: number }` | Ruft Verlauf ab |
