#!/usr/bin/env bash
# ============================================================
# GizmoVault — Automated SQLite Database Backup Script
# Performs atomic VACUUM INTO backup without locking reads
# ============================================================

set -euo pipefail

DB_PATH="${DB_PATH:-/var/data/gizmovault.sqlite}"
BACKUP_DIR="${BACKUP_DIR:-/var/data/backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/gizmovault_backup_${TIMESTAMP}.sqlite"

mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Starting atomic backup of ${DB_PATH}..."

# SQLite VACUUM INTO ensures a 100% consistent, uncorrupted backup even under heavy write load
sqlite3 "${DB_PATH}" "VACUUM INTO '${BACKUP_FILE}';"

# Compress backup
gzip -9 "${BACKUP_FILE}"
echo "[$(date)] Backup completed successfully: ${BACKUP_FILE}.gz"

# Retain backups for 14 days, delete older
find "${BACKUP_DIR}" -name "gizmovault_backup_*.sqlite.gz" -type f -mtime +14 -delete
echo "[$(date)] Pruned backups older than 14 days."
