# 💾 Backup & Disaster Recovery Guide

> **Production-ready backup stratejisi: RTO 15 dakika, RPO 5 dakika**

[Ana Sayfa](../README.md) | [Infrastructure](01_Roadmap_TechStack.md)

---

## 📋 İçindekiler

1. [Backup Stratejisi](#backup-stratejisi)
2. [Automated Backup Script](#automated-backup-script)
3. [Point-in-Time Recovery (PITR)](#point-in-time-recovery-pitr)
4. [Backup Retention Policy](#backup-retention-policy)
5. [Restore Testing](#restore-testing)
6. [Disaster Recovery Plan](#disaster-recovery-plan)

---

## Backup Stratejisi

### RTO (Recovery Time Objective) & RPO (Recovery Point Objective)

| Tier | RTO | RPO | Backup Type | Frequency |
|------|-----|-----|-------------|-----------|
| **Critical** | 15 min | 5 min | PITR (WAL) | Continuous |
| **Important** | 1 hour | 1 hour | Logical dump | Hourly |
| **Standard** | 4 hours | 24 hours | Daily dump | Daily |

### Backup Türleri

#### 1. **Continuous Backup (PITR)** ⭐ Önerilen

**Avantajları:**
- ✅ En düşük RPO (5 dakika)
- ✅ Any-point-in-time restore
- ✅ Minimal data loss

**Dezavantajları:**
- ❌ Yüksek storage maliyeti
- ❌ Karmaşık setup

```bash
# PostgreSQL WAL archiving aktif et
# postgresql.conf
wal_level = replica
archive_mode = on
archive_command = 'cp %p /backup/wal/%f'
max_wal_senders = 3
```

#### 2. **Logical Backup (pg_dump)**

**Avantajları:**
- ✅ Kolay restore
- ✅ Selective restore (sadece bir tablo)
- ✅ Cross-version restore

**Dezavantajları:**
- ❌ Yavaş (büyük DB için)
- ❌ Backup sırasında load

```bash
pg_dump -Fc -h localhost -U postgres -d hzm_db > backup.dump
```

#### 3. **Physical Backup (pg_basebackup)**

**Avantajları:**
- ✅ Çok hızlı
- ✅ Tam cluster backup

**Dezavantajları:**
- ❌ Aynı PostgreSQL versiyonu gerekli
- ❌ Tüm DB restore (selective yok)

```bash
pg_basebackup -h localhost -U postgres -D /backup/base -Ft -z -P
```

---

## Automated Backup Script

### Daily Backup Script

```bash
#!/bin/bash
# backup-daily.sh

set -e  # Hata durumunda dur

# Config
DB_NAME="hzm_db"
DB_USER="postgres"
DB_HOST="localhost"
BACKUP_DIR="/backup/daily"
RETENTION_DAYS=30
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${DATE}.dump"
LOG_FILE="${BACKUP_DIR}/backup_${DATE}.log"

# S3 Config (opsiyonel)
S3_BUCKET="s3://hzm-backups/daily/"

echo "[$(date)] Starting backup..." | tee -a $LOG_FILE

# 1. Create backup directory
mkdir -p $BACKUP_DIR

# 2. pg_dump (custom format, compressed)
echo "[$(date)] Running pg_dump..." | tee -a $LOG_FILE
pg_dump -Fc -h $DB_HOST -U $DB_USER -d $DB_NAME -f $BACKUP_FILE 2>> $LOG_FILE

# 3. Check backup file exists and not empty
if [ ! -s $BACKUP_FILE ]; then
  echo "[$(date)] ERROR: Backup file is empty!" | tee -a $LOG_FILE
  exit 1
fi

# 4. Calculate size and checksum
BACKUP_SIZE=$(du -h $BACKUP_FILE | cut -f1)
BACKUP_MD5=$(md5sum $BACKUP_FILE | cut -d' ' -f1)
echo "[$(date)] Backup size: $BACKUP_SIZE, MD5: $BACKUP_MD5" | tee -a $LOG_FILE

# 5. Upload to S3 (opsiyonel)
if command -v aws &> /dev/null; then
  echo "[$(date)] Uploading to S3..." | tee -a $LOG_FILE
  aws s3 cp $BACKUP_FILE $S3_BUCKET --storage-class STANDARD_IA
fi

# 6. Delete old backups (retention policy)
echo "[$(date)] Cleaning old backups (retention: $RETENTION_DAYS days)..." | tee -a $LOG_FILE
find $BACKUP_DIR -name "*.dump" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "*.log" -mtime +$RETENTION_DAYS -delete

# 7. Test restore (dry-run)
echo "[$(date)] Testing restore (dry-run)..." | tee -a $LOG_FILE
pg_restore --list $BACKUP_FILE > /dev/null 2>> $LOG_FILE

if [ $? -eq 0 ]; then
  echo "[$(date)] ✅ Backup completed successfully!" | tee -a $LOG_FILE
  # Send success notification (Slack/Email)
  curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
    -H 'Content-Type: application/json' \
    -d "{\"text\":\"✅ Backup completed: $BACKUP_FILE ($BACKUP_SIZE)\"}"
else
  echo "[$(date)] ❌ Backup failed!" | tee -a $LOG_FILE
  # Send alert
  curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
    -H 'Content-Type: application/json' \
    -d "{\"text\":\"❌ Backup FAILED: Check logs at $LOG_FILE\"}"
  exit 1
fi
```

### Crontab Setup

```bash
# Günlük backup (gece 2'de)
0 2 * * * /opt/scripts/backup-daily.sh

# Saatlik backup (kritik prod)
0 * * * * /opt/scripts/backup-hourly.sh

# Haftalık full backup (Pazar gece 1'de)
0 1 * * 0 /opt/scripts/backup-weekly.sh
```

---

## Point-in-Time Recovery (PITR)

### Setup

**1. WAL Archiving Aktif Et**

```bash
# postgresql.conf
wal_level = replica
archive_mode = on
archive_command = 'test ! -f /backup/wal/%f && cp %p /backup/wal/%f'
archive_timeout = 300  # 5 dakika
max_wal_senders = 3
wal_keep_size = 1GB
```

**2. Base Backup Al**

```bash
pg_basebackup -h localhost -U postgres -D /backup/base -Ft -z -P
```

**3. WAL'ları S3'e Yükle (Önerilen)**

```bash
# archive_command (S3)
archive_command = 'aws s3 cp %p s3://hzm-backups/wal/%f'
```

### Restore from PITR

**Senaryo: 2025-10-21 14:30'a dön**

```bash
# 1. PostgreSQL'i durdur
sudo systemctl stop postgresql

# 2. Mevcut data dizinini yedekle
mv /var/lib/postgresql/14/main /var/lib/postgresql/14/main.old

# 3. Base backup'ı restore et
mkdir -p /var/lib/postgresql/14/main
cd /var/lib/postgresql/14/main
tar -xzf /backup/base/base.tar.gz

# 4. recovery.conf oluştur (PostgreSQL 12+: recovery.signal)
touch /var/lib/postgresql/14/main/recovery.signal

cat > /var/lib/postgresql/14/main/postgresql.auto.conf <<EOF
restore_command = 'cp /backup/wal/%f %p'
recovery_target_time = '2025-10-21 14:30:00'
recovery_target_action = 'promote'
EOF

# 5. PostgreSQL'i başlat
sudo systemctl start postgresql

# 6. Log'ları izle
tail -f /var/log/postgresql/postgresql-14-main.log

# 7. Recovery tamamlandı mı kontrol et
psql -U postgres -c "SELECT pg_is_in_recovery();"
# false dönmeli (artık recovery mode değil)
```

---

## Backup Retention Policy

### Retention Schedule

| Backup Type | Retention | Storage Tier | Cost/Month (1TB) |
|-------------|-----------|--------------|------------------|
| **Hourly** | 48 hours | S3 Standard | $23 |
| **Daily** | 30 days | S3 Standard-IA | $12.50 |
| **Weekly** | 3 months | S3 Glacier | $4 |
| **Monthly** | 1 year | S3 Glacier Deep Archive | $1 |

### Lifecycle Policy (S3)

```json
{
  "Rules": [
    {
      "Id": "HourlyBackupRetention",
      "Status": "Enabled",
      "Prefix": "hourly/",
      "Transitions": [
        {
          "Days": 2,
          "StorageClass": "GLACIER"
        }
      ],
      "Expiration": {
        "Days": 2
      }
    },
    {
      "Id": "DailyBackupRetention",
      "Status": "Enabled",
      "Prefix": "daily/",
      "Transitions": [
        {
          "Days": 7,
          "StorageClass": "STANDARD_IA"
        },
        {
          "Days": 30,
          "StorageClass": "GLACIER"
        }
      ],
      "Expiration": {
        "Days": 30
      }
    },
    {
      "Id": "WeeklyBackupRetention",
      "Status": "Enabled",
      "Prefix": "weekly/",
      "Transitions": [
        {
          "Days": 30,
          "StorageClass": "GLACIER"
        }
      ],
      "Expiration": {
        "Days": 90
      }
    },
    {
      "Id": "MonthlyBackupRetention",
      "Status": "Enabled",
      "Prefix": "monthly/",
      "Transitions": [
        {
          "Days": 90,
          "StorageClass": "GLACIER_DEEP_ARCHIVE"
        }
      ],
      "Expiration": {
        "Days": 365
      }
    }
  ]
}
```

---

## Restore Testing

### Monthly Restore Test

**Amaç:** Backup'ların gerçekten çalıştığını doğrula!

```bash
#!/bin/bash
# test-restore.sh

set -e

TEST_DB="hzm_db_test_restore"
LATEST_BACKUP=$(ls -t /backup/daily/*.dump | head -1)
TEST_LOG="/backup/test_restore_$(date +%Y%m%d).log"

echo "[$(date)] Testing restore from: $LATEST_BACKUP" | tee $TEST_LOG

# 1. Test DB oluştur
psql -U postgres -c "DROP DATABASE IF EXISTS $TEST_DB;" 2>> $TEST_LOG
psql -U postgres -c "CREATE DATABASE $TEST_DB;" 2>> $TEST_LOG

# 2. Restore et
echo "[$(date)] Restoring..." | tee -a $TEST_LOG
time pg_restore -h localhost -U postgres -d $TEST_DB $LATEST_BACKUP 2>> $TEST_LOG

# 3. Validation queries
echo "[$(date)] Running validation queries..." | tee -a $TEST_LOG

# Tablo sayısı doğru mu?
TABLE_COUNT=$(psql -U postgres -d $TEST_DB -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'core';")
echo "Table count: $TABLE_COUNT" | tee -a $TEST_LOG

# Tenant sayısı doğru mu?
TENANT_COUNT=$(psql -U postgres -d $TEST_DB -t -c "SELECT COUNT(*) FROM core.tenants WHERE is_deleted = FALSE;")
echo "Tenant count: $TENANT_COUNT" | tee -a $TEST_LOG

# User sayısı doğru mu?
USER_COUNT=$(psql -U postgres -d $TEST_DB -t -c "SELECT COUNT(*) FROM core.users WHERE is_deleted = FALSE;")
echo "User count: $USER_COUNT" | tee -a $TEST_LOG

# 4. Cleanup
psql -U postgres -c "DROP DATABASE $TEST_DB;" 2>> $TEST_LOG

echo "[$(date)] ✅ Restore test completed successfully!" | tee -a $TEST_LOG

# Send notification
curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
  -H 'Content-Type: application/json' \
  -d "{\"text\":\"✅ Monthly restore test PASSED\n- Tables: $TABLE_COUNT\n- Tenants: $TENANT_COUNT\n- Users: $USER_COUNT\"}"
```

**Crontab:**
```bash
# Ayın 1'inde restore test
0 3 1 * * /opt/scripts/test-restore.sh
```

---

## Disaster Recovery Plan

### Disaster Scenarios

#### Senaryo 1: Tek tablo yanlışlıkla silindi

**RTO:** 5 dakika  
**RPO:** Son backup'a kadar (max 1 saat)

```bash
# 1. Latest backup'tan sadece o tabloyu restore et
pg_restore -h localhost -U postgres -d hzm_db \
  --table=core.users \
  /backup/daily/hzm_db_20251021_020000.dump

# veya PITR ile
# recovery_target_time = '2025-10-21 13:55:00'  # Silme işleminden 5 dk önce
```

#### Senaryo 2: Tüm database corrupt

**RTO:** 15 dakika  
**RPO:** Son backup'a kadar

```bash
# 1. DB drop & recreate
psql -U postgres -c "DROP DATABASE hzm_db;"
psql -U postgres -c "CREATE DATABASE hzm_db;"

# 2. Latest backup restore
pg_restore -h localhost -U postgres -d hzm_db \
  /backup/daily/hzm_db_20251021_020000.dump

# 3. Health check
psql -U postgres -d hzm_db -c "SELECT COUNT(*) FROM core.tenants;"
```

#### Senaryo 3: Sunucu tamamen kaybedildi (AWS region down)

**RTO:** 30 dakika  
**RPO:** 5 dakika (PITR)

**Adımlar:**

1. **Yeni region'da sunucu ayağa kaldır**
```bash
# Terraform/CloudFormation ile
terraform apply -var="region=us-west-2"
```

2. **S3'ten base backup download et**
```bash
aws s3 sync s3://hzm-backups/base/ /backup/base/
tar -xzf /backup/base/base.tar.gz -C /var/lib/postgresql/14/main
```

3. **WAL'ları restore et**
```bash
aws s3 sync s3://hzm-backups/wal/ /backup/wal/

# recovery.signal oluştur
touch /var/lib/postgresql/14/main/recovery.signal

cat > /var/lib/postgresql/14/main/postgresql.auto.conf <<EOF
restore_command = 'aws s3 cp s3://hzm-backups/wal/%f %p'
recovery_target_timeline = 'latest'
EOF
```

4. **PostgreSQL başlat ve doğrula**
```bash
sudo systemctl start postgresql
psql -U postgres -c "SELECT pg_is_in_recovery();"
```

5. **DNS'i yeni sunucuya yönlendir**
```bash
# Route53/Cloudflare
aws route53 change-resource-record-sets --hosted-zone-id Z123 \
  --change-batch file://dns-update.json
```

### DR Checklist

- [ ] **Backup verify**: Son 7 günlük backup'lar var mı?
- [ ] **Restore test**: Son 30 günde restore test yapıldı mı?
- [ ] **Credentials**: PostgreSQL credentials vault'ta güvenli mi?
- [ ] **Documentation**: DR prosedürü güncel mi?
- [ ] **Team training**: Team DR drill yaptı mı? (her 6 ayda bir)
- [ ] **Monitoring**: Backup failure alertleri çalışıyor mu?
- [ ] **S3 replication**: Cross-region replication aktif mi?

### Cost Estimation (1TB Database)

| Item | Cost/Month |
|------|------------|
| Daily backups (30 days, S3 Standard-IA) | $12.50 |
| Weekly backups (12 weeks, S3 Glacier) | $4 |
| Monthly backups (12 months, Deep Archive) | $1 |
| WAL archive (S3 Standard, 100GB) | $2.30 |
| S3 requests & data transfer | $5 |
| **Total** | **~$25/month** |

### Automation Tools (Önerilen)

#### pgBackRest (Önerilen)

```bash
# Install
sudo apt install pgbackrest

# Config (/etc/pgbackrest/pgbackrest.conf)
[global]
repo1-path=/backup/pgbackrest
repo1-retention-full=7
repo1-retention-diff=14

[hzm]
pg1-path=/var/lib/postgresql/14/main
pg1-port=5432

# Full backup
pgbackrest --stanza=hzm backup --type=full

# Incremental backup
pgbackrest --stanza=hzm backup --type=incr

# Restore
pgbackrest --stanza=hzm restore
```

#### Barman (Alternative)

```bash
# Install
sudo apt install barman

# Config
barman check hzm
barman backup hzm
barman recover hzm latest /var/lib/postgresql/14/main
```

---

## 🔗 İlgili Dökümanlar

- [15-Database-Migrations/README.md](../15-Database-Migrations/README.md) - Migration strategy
- [01_Roadmap_TechStack.md](01_Roadmap_TechStack.md) - Scale strategy
- [07_Monitoring_Dashboards.md](07_Monitoring_Dashboards.md) - Backup monitoring

---

**[Ana Sayfa](../README.md) | [Infrastructure](01_Roadmap_TechStack.md)**


