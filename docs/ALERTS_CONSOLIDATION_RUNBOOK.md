# Alert flood fix: what changed and how to deploy

## Root cause

Every controller uplink with DI1/DI2 high called `alertService.create()`. Devices report the
input *level* on every uplink, so a door left open or a motion input held high produced, per
uplink: 1 `alerts` row + 1 `alert_cases` row + 1 `alert_case_activities` row + 1 WhatsApp/email
send. Readers then paged that table with `ORDER BY created_at` (no index) plus a full
`COUNT(*)`. The Regions page pulled raw alerts and looped `transformers.find()` per alert.

## What changed

### Write path (stops the flood)
| Change | File |
|---|---|
| **Edge detection:** an alert is raised only when DI1/DI2 goes false→true (the previous state is read from `controllers.last_reading_di1/di2` before it is overwritten) | `ControllerReadingServiceImpl` |
| **Fold into open alert:** a new edge on a transformer+device that already has an open case (NEW / ACKNOWLEDGED / DISPATCHED) increments `occurrence_count` and `last_seen_at` instead of inserting new rows | `AlertServiceImpl#raise` |
| **Notification throttle:** while a case is open, repeat triggers re-notify at most every `alerts.renotify-minutes` (default 30) | `AlertServiceImpl#raise` |
| **Per-transformer lock:** `SELECT … FOR UPDATE` on `transformer_alert_state` stops two simultaneous uplinks from both creating alerts | `AlertStateService#lockTransformer` |
| Sensor path (`SensorReadingServiceImpl`) uses the same fold + throttle | |
| **Retention:** nightly (02:30) deletion of closed alerts older than 90 days, in batches of 500. Open alerts and each transformer's newest 3 alerts are never deleted | `AlertRetentionJob` |

### Per-transformer snapshot ("last 3 alerts")
New table `transformer_alert_state`, one row per transformer: open count, total alerts,
total events, latest alert, and a JSON snapshot of the 3 most recent alerts. It is
recomputed on every alert write with index-bounded queries and rebuilt on startup.
Dashboard, map and Regions read this instead of the alerts table.

### Read path
| Endpoint | Notes |
|---|---|
| `GET /api/v1/alerts?page&size&status&transformerId&q` | Single SQL (alert + case joined), `ORDER BY id DESC` on indexes. `status` = `open`, `unassigned`, `NEW`, `ACKNOWLEDGED`, `DISPATCHED`, `RESOLVED` or `FALSE_ALARM` |
| `GET /api/v1/alerts/summary` | Counts by status, unassigned, last 24h, total events, transformers alerting, 12-month trend |
| `GET /api/v1/alerts/transformers?openOnly=true` | Snapshot rows for map pins and region rollups |
| `GET /api/v1/alerts/transformer/{id}/recent` | The 3 latest alerts for one transformer |
| `POST /api/v1/alerts/transformers/rebuild` | ADMIN only: recompute all snapshots |
| `GET /api/v1/alerts/sensor/{id}` | Now capped at the newest 100 |

### Frontend
* **Alerts:** status chips and search are applied on the server (debounced), so they cover all alerts rather than only the current page. Tiles come from `/summary`. Rows show a `×N` badge and the last-seen time for folded repeats.
* **Dashboard:** latest alert per transformer and region alert counts come from the snapshot. The "Live Alerts" tile shows open cases. The recent list fetches 10 rows instead of 50.
* **Regions:** region alert counts come from the snapshot through a Map lookup, and the monthly chart uses `/summary`. The page no longer downloads raw alert rows.

## Deploy (live server)

**0. Pre-check.** Edge detection needs the Phase2 controller columns. With `ddl-auto=validate`, transformer-service would not boot without them anyway.
```sql
SHOW COLUMNS FROM tms.controllers LIKE 'last_reading_di%';   -- expect 2 rows
```
> Note: `20261004_phase2_denorm_last_reading.sql` uses `ADD COLUMN IF NOT EXISTS`. That is MariaDB syntax and **fails on MySQL 8**. If the columns are missing, add them with plain `ALTER TABLE … ADD COLUMN`.

**1. Build the new images** (the old containers keep running):
```bash
cd ~/apps/smart-monitoring && git pull
docker compose -f docker-compose.live.yml --env-file .env.live build --no-cache transformer-service transformer-frontend
```

**2. Stop transformer-service**, so no alerts are written during the table swap:
```bash
docker compose -f docker-compose.live.yml --env-file .env.live stop transformer-service
```

**3. Run the migration.** Part 1 is one-time and guarded. Part 2 is idempotent.
```bash
docker run --rm -i mysql:8.0 mysql -h 192.168.15.228 -uroot -p tms < backend/db-init/20261015_alert_consolidation.sql
```
It prints `alerts_before / alerts_after / duplicate_cases_auto_closed`. In a test on MySQL 8.0.46, 300k rows went to 248 in about 16 s; expect a few minutes for millions of rows.

**4. Start transformer-service, then the frontend:**
```bash
docker compose -f docker-compose.live.yml --env-file .env.live up -d transformer-service
docker logs -f transformer-service | grep -i "alert state rebuilt"     # expect "for 87/87 transformers"
docker compose -f docker-compose.live.yml --env-file .env.live up -d transformer-frontend
```

**5. Verify:**
```bash
TOKEN=$(curl -s -X POST http://154.73.80.22/api/v1/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"emagodi@powertel.co.zw","password":"…"}' | jq -r .access_token)
curl -s -w '\n%{time_total}s\n' -H "Authorization: Bearer $TOKEN" 'http://154.73.80.22/api/v1/alerts?size=25' | tail -c 200
curl -s -H "Authorization: Bearer $TOKEN" http://154.73.80.22/api/v1/alerts/summary | jq
curl -s -H "Authorization: Bearer $TOKEN" 'http://154.73.80.22/api/v1/alerts/transformers?openOnly=true' | jq 'length'
```

**6. After a few days**, once you are happy, free the disk:
```sql
DROP TABLE tms.alerts_bak_20261015, tms.alert_cases_bak_20261015, tms.alert_case_activities_bak_20261015;
```

### Rollback
* **Code:** redeploy the previous transformer-service image. The extra columns and table are harmless to the old code.
* **Data:** use the `RENAME TABLE` statement in the SQL file header to swap the backup tables back.

### Tunables
These are optional. Put them in `backend/config/transformer-service.properties` and restart config-server, then transformer-service.
```properties
alerts.renotify-minutes=30
alerts.retention.enabled=true
alerts.retention.closed-days=90
alerts.retention.cron=0 30 2 * * *
```
