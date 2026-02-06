# TODOs (Stand 22 Jan 2026)

## Deployment-Voraussetzungen
- [ ] S3-Bucket `serverless-chat-terraform-state-us-east-1` anlegen (oder Namen im Backend-Block anpassen).
- [ ] DynamoDB-Tabelle `terraform-state-lock` mit PK `LockID` für Terraform-Locks anlegen.
- [ ] Backend-Artefakt bauen und für Terraform bereitstellen (aktuell zeigt `modules/lambda/placeholder.zip` auf ein Platzhalterzip).
- [ ] AWS CLI konfigurieren (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`), Region: `eu-central-1` (Standard im Code/IaC).

## Lokale Checks (kostenfrei)
- [ ] `make validate-all` ausführen (Docker): Lint + Tests + Terraform Validate.
- [ ] Frontend `.env` vorbereiten (Outputs aus Terraform, optional `VITE_MOCK_AUTH=false` wenn Cognito aktiv genutzt wird).

## Kostenarme, chronologische Reihenfolge (Dev/Demo)
0) Vorab: Budget/Cost Alert in AWS setzen; Region festlegen.
1) Remote State: Bucket + Lock-Tabelle anlegen; Backend-Block in `infrastructure/main.tf` ggf. anpassen.
2) Terraform Init/Plan: `terraform init` und `terraform plan -var-file=environments/dev.tfvars`.
3) Kurzlebiges Provisioning: `terraform apply -var-file=environments/dev.tfvars` (nur für Smoke-Tests).
4) Outputs notieren: WebSocket URL, Cognito Pool ID, Client ID, CloudFront URL, Region; `.env` aktualisieren.
5) CI/CD Secrets setzen: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, optional `SONAR_TOKEN`.
6) Cleanup nach Tests: `terraform destroy -var-file=environments/dev.tfvars`; bei Bedarf auch State-Bucket + Lock-Tabelle löschen.
