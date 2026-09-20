# GizmoVault — Disaster Recovery & Backup Plan

## 1. Backup Strategy
- **Frequency:** Automated cron execution every 6 hours (`0 */6 * * *`).
- **Method:** `sqlite3 VACUUM INTO` creates an atomic, crash-consistent point-in-time snapshot without blocking reader/writer queries.
- **Compression:** Gzip level 9 (`.sqlite.gz`).
- **Retention:** 14-day local retention window with automated pruning.
- **Offsite Sync:** Daily push to Google Cloud Storage (`gs://gizmovault-backups/prod/`) with Object Versioning and Lifecycle deletion rules.

## 2. Recovery Time Objective (RTO) & Recovery Point Objective (RPO)
- **Target RTO (Recovery Time):** < 15 minutes.
- **Target RPO (Data Loss Tolerance):** < 6 hours.

## 3. Step-by-Step Restoration Procedure
1. **Stop Application Container:**
   ```bash
   docker-compose down
   ```
2. **Decompress Most Recent Snapshot:**
   ```bash
   gunzip -c /var/data/backups/gizmovault_backup_YYYYMMDD_HHMMSS.sqlite.gz > /var/data/gizmovault.sqlite
   ```
3. **Run Integrity Check:**
   ```bash
   sqlite3 /var/data/gizmovault.sqlite "PRAGMA integrity_check;"
   # Must return "ok"
   ```
4. **Restart Application Container:**
   ```bash
   docker-compose up -d
   ```
5. **Verify Health Probes:**
   ```bash
   curl -f http://localhost:4000/api/health/ready
   ```
