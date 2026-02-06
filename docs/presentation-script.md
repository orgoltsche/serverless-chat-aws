# Präsentationsskript – Serverless Chat Application

## Folie 1 – Titel
Ich stelle die Anwendung als Echtzeit-WebSocket-Chat auf AWS vor: Vue 3 im Frontend, Lambda im Backend und DynamoDB als Datenspeicher. Ich nenne kurz den Projektrahmen an der TH Brandenburg und den Fokus der Präsentation: Architektur und Delivery.

## Folie 2 – Gliederung
Ich skizziere die Agenda in genau dieser Reihenfolge: Zweck und Features, Softwarearchitektur, AWS-Architektur, Datenmodell, CI/CD-Prozess mit Local Development, Live-Demo und zum Schluss Risiken mit Verbesserungen.

## Folie 3 – Zweck und Features
Das Ziel ist ein textbasierter Echtzeit-Chat ohne eigenen Serverbetrieb. Die Kernfunktionen sind Authentifizierung über Cognito, Chat-Räume, Nachrichtenpersistenz sowie History/Pagination in DynamoDB. 

Für den Betrieb wichtig: Verbindungen werden TTL-basiert nach 24 Stunden aufgeräumt, und Datei- oder Bildtransfer ist bewusst nicht im Scope.

## Folie 4 – Softwarearchitektur (Text)
Im Frontend setzen wir Vue 3 mit Vite und Pinia ein. Das Backend besteht aus vier Lambda-Handlern hinter API Gateway WebSocket: `connect`, `disconnect`, `sendMessage` und `getMessages`. 

Der Ablauf ist: Login, dann WebSocket-Aufbau mit `userId` und `username`, Nachricht in DynamoDB speichern plus Broadcast, Verlauf per Query laden und Cleanup der Verbindungen über TTL.

## Folie 5 – Softwarearchitektur (Diagramm)
Chronologisch beginnt der Ablauf mit `Browser / Vue 3 SPA -> Cognito User Pool JWT` (`Sign-up / Auth`), danach öffnet der Client `Browser / Vue 3 SPA -- wss --> API Gateway v2 WebSocket`. 

Der Gateway verteilt dann auf die vier Routen: `API Gateway v2 WebSocket -> connect`, `API Gateway v2 WebSocket -> sendMessage`, `API Gateway v2 WebSocket -> getMessages` und später `API Gateway v2 WebSocket -> disconnect`. 

Beim Verbindungsaufbau schreibt `connect -> DynamoDB connections TTL 24h` den Connection-Eintrag. 

Beim Senden prüft `sendMessage -. verify JWT .-> Cognito User Pool JWT` das Token, schreibt mit `sendMessage -> DynamoDB messages GSI userId-index` die Nachricht und liefert sie über `sendMessage -- APIGW callback --> Browser / Vue 3 SPA` zurück an die Clients. 

Beim Laden der Historie prüft `getMessages -. verify JWT .-> Cognito User Pool JWT` ebenfalls das Token und liest über `getMessages -> DynamoDB messages GSI userId-index`. 

Beim Verlassen löscht `disconnect -> DynamoDB connections TTL 24h` den Verbindungseintrag.

## Folie 6 – AWS-Architektur (Text)
Am Edge liefern CloudFront und S3 die SPA aus. Für Echtzeit ist API Gateway WebSocket der Einstiegspunkt. Compute läuft als Node.js-20-Lambdas in privaten Subnetzen hinter NAT. Auth kommt aus Cognito User Pool, Daten liegen in DynamoDB (`connections` mit TTL, `messages`), und CloudWatch Logs übernimmt Logging mit 14 Tagen Aufbewahrung. Das Gesamtsetup wird über Terraform verwaltet.

## Folie 7 – AWS-Architektur (Diagramm)
Der Ablauf startet am Edge mit `Browser -> CloudFront` (`HTTPS`) und `CloudFront -> S3 Static Hosting`, also Auslieferung der SPA. 

Parallel laufen Identität und Echtzeitkanal: `Browser -> Cognito User Pool` (`Signup / Login`) und `Browser -- wss --> API Gateway v2`. 

Von dort gehen die Routen in die Compute-Schicht: `API Gateway v2 -> connect`, `API Gateway v2 -> sendMessage`, `API Gateway v2 -> getMessages` und später `API Gateway v2 -> disconnect`. 

Auf Datenebene schreibt `connect -> DynamoDB connections`, `sendMessage -> DynamoDB messages`, `getMessages -> DynamoDB messages` liest Historie, und beim Abbau löscht `disconnect -> DynamoDB connections`. 

Auth-Prüfung im Request-Pfad ist als gestrichelter Fluss dargestellt: `sendMessage -. verify JWT .-> Cognito User Pool` und `getMessages -. verify JWT .-> Cognito User Pool`. 

Für Observability schreibt jede Lambda in Logs: `connect -> CloudWatch Logs`, `disconnect -> CloudWatch Logs`, `sendMessage -> CloudWatch Logs` und `getMessages -> CloudWatch Logs`. 

Infrastrukturseitig zeigt `NAT Gateway --- Lambdas Node.js 20 (private Subnets)` die Netzanbindung der privaten Subnetze.

## Folie 8 – Datenmodell (DynamoDB)
`connections` hat `connectionId` als Partition Key und speichert `userId`, `username`, `connectedAt` und `ttl` für das 24h-Autocleanup. `messages` nutzt `roomId` als Partition Key und `timestamp#messageId` als Sort Key mit Feldern wie `userId`, `username`, `content` und `createdAt`. Der `userId-index` ist für gezielte User-Historien da, und On-Demand Billing deckt Lastspitzen elastisch ab.

## Folie 9 – CI/CD-Prozess (GitHub Actions) & Local Development
Der Delivery-Pfad einer Änderung ist: Commit und Pull Request, danach Merge nach `main`; damit läuft CI mit Backend/Frontend-Linting, Typecheck, Tests, Terraform `fmt/validate`, `tfsec` und `npm audit` (Dependency check) + (optional SonarCloud). 

Für das Release wird der Deploy-Workflow ausgeführt, automatisch bei Push auf `main` oder manuell per `workflow_dispatch`; für Produktion wählen wir dabei `environment=prod`. 

Die technische Reihenfolge bis in die Zielumgebung ist klar: zuerst Terraform `init/plan/apply` für Infrastruktur, danach Backend-Build und Deployment der vier Lambdas via ZIP + `aws lambda update-function-code`, anschließend Frontend-Build mit Terraform-Outputs, `aws s3 sync` und CloudFront-Invalidation.

Lokal entwickeln und bauen wir containerbasiert mit Docker Compose und Make: `make build`, `make up`, `make down`, plus `make test-backend`, `make test-frontend` und `make validate-terraform`. 

Das Frontend läuft auf `http://localhost:3000`, DynamoDB Local auf Port `8000`. Wichtige Umgebungseinstellungen sind im Backend `CONNECTIONS_TABLE`, `MESSAGES_TABLE`, `AWS_REGION`, `DYNAMODB_ENDPOINT` und im Frontend `VITE_WEBSOCKET_URL`, `VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_CLIENT_ID`, `VITE_AWS_REGION` sowie optional `VITE_MOCK_AUTH=true`.

## Folie 10 – Live-Demo
DEMO

## Folie 11 – Risiken und Verbesserungen
Erstens ist Skalierung der kritische Punkt: Bei tausenden gleichzeitigen Nutzern wird der aktuelle Full-Scan der `connections`-Tabelle pro Nachricht teuer und langsam. Als Verbesserung sollten Verbindungen nach Räumen oder Shards partitioniert und der Fan-out über Amazon Simple Notification Service (SNS) und Amazon Simple Queue Service (SQS) entkoppelt werden. Das ist besser, weil nicht mehr eine Funktion alle Verbindungen scannt, sondern mehrere Verbraucher jeweils Teilmengen parallel verarbeiten; dadurch verteilt sich Last horizontal über mehrere Worker statt auf einen zentralen Engpass. Zweitens fehlt robuste Zustellung unter Last: Der Broadcast läuft aktuell fire-and-forget über viele Einzelzustellungen; bei Peaks drohen stille Teilverluste oder hohe Latenz. Hier helfen ein queue-basierter Zustellpfad mit Wiederholversuchen (Retries) und einer Dead-Letter Queue (DLQ) für dauerhaft fehlschlagende Nachrichten. Das ist besser, weil fehlgeschlagene Zustellungen sichtbar gesammelt und gezielt nachbearbeitet werden, statt unbemerkt verloren zu gehen. Drittens ist die Betriebsbeobachtung noch zu schwach: Logs allein reichen für schnellen Incident-Response nicht. Deshalb sollten wir strukturierte Logs, fachliche CloudWatch-Metriken, Alarme und Request-Tracing einführen. Das ist besser, weil Probleme früher erkannt, schneller eingegrenzt und mit klaren Messwerten priorisiert werden können.

## Folie 12 – Abschluss
Ich schließe mit dem Kernziel: ein schlanker serverloser Echtzeit-Chat auf AWS, und öffne für Fragen zu Architektur, Betrieb und Delivery.
