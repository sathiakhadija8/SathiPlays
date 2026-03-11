# SathiPlays Remote-First Roadmap (Multi-Year)

## Goal
Run SathiPlays fully remote with durable data, safe releases, and a workflow that supports years of feature development without relying on local Docker/MySQL on your Mac.

## Target End State
- App and database run on remote infrastructure only.
- Local Mac is only a browser + code editor (optional local git clone).
- Backups are automatic, offsite, tested, and restorable.
- Every schema change is versioned with migrations.
- Releases are repeatable and low-risk.
- Operational monitoring alerts before incidents become outages.

## Phase 0: Immediate Baseline (This Week)
1. Deploy production stack remotely (app + mysql + caddy + backup + cleanup).
2. Store production env safely outside git.
3. Enforce strong secrets and PIN auth settings.
4. Add preflight checks before every deploy.
5. Add runbook for daily/weekly/monthly operations.

Definition of done:
- Remote stack is up and reachable over HTTPS.
- Local Mac no longer runs local Docker for daily usage.
- Manual backup and health checks pass.

## Phase 1: Data Durability (Week 1-2)
1. Keep daily automated DB dumps.
2. Add offsite backup sync (S3/Backblaze/other object storage).
3. Define retention policy:
   - Daily backups: 35-90 days.
   - Monthly backups: 24+ months.
4. Add restore rehearsal process and run monthly.
5. Add documented RPO/RTO targets.

Definition of done:
- Offsite backup exists and can be restored.
- Last restore drill completed successfully.
- Recovery targets are documented.

## Phase 2: Safe Feature Delivery (Week 2-4)
1. Introduce SQL migration system (`db/migrations` + runner).
2. Add migration naming and review rules.
3. Add backward-compatible DB change policy:
   - Additive changes first.
   - App rollout second.
   - Cleanup/removal later.
4. Add staging environment for schema change testing.

Definition of done:
- New features no longer depend on ad-hoc schema edits.
- Migrations are reproducible across environments.

## Phase 3: Observability and Performance (Month 2)
1. Add uptime checks for app and key APIs.
2. Add DB disk/cpu/connection alerts.
3. Add slow query review process.
4. Add periodic index tuning for heavy tables.

Definition of done:
- You receive proactive alerts.
- Performance regressions are visible and actionable.

## Phase 4: Long-Term Data Lifecycle (Month 2-4)
1. Identify high-growth tables (logs/check-ins/events).
2. Add archival strategy for old records.
3. Keep product UX fast by separating hot vs archive data.
4. Add annual table and index maintenance window.

Definition of done:
- DB growth stays predictable.
- Core UX remains responsive as data grows over years.

## Phase 5: Release Reliability (Ongoing)
1. Standardize release flow:
   - preflight
   - backup
   - deploy
   - post-deploy health checks
2. Keep rollback playbook tested.
3. Add changelog and release notes discipline.

Definition of done:
- Releases are consistent and recoverable.
- Incidents have a clear runbook.

## Security Hardening Track (Parallel)
1. Keep `PIN_COOKIE_SECURE=true` in production.
2. Rotate secrets on a regular schedule.
3. Restrict DB exposure (private network preferred).
4. Keep host patching cadence.

Definition of done:
- Security posture is strong enough for always-on personal production usage.

## Ongoing Operating Cadence
- Daily: monitor health + backup success.
- Weekly: verify key feature flows and storage growth.
- Monthly: restore drill and cleanup policy review.
- Quarterly: schema/index review and release process audit.

## What "Fully Remote" Means for You
- You use SathiPlays from browser on your Mac.
- Data lives in remote MySQL + remote backups.
- Your Mac storage does not grow from local Docker DB volumes.
- You can keep adding features safely because the data workflow is controlled.
