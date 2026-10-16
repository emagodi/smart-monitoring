# Incident response lifecycle: release notes, deploy steps and roadmap

## What this release adds

**Lifecycle.** Every alert case now moves through these stages:

New → Acknowledged (contact centre) → Dispatched (vehicle assigned) → En route (crew accepted) → On scene → Closed

A closed case records one of five outcomes: Real threat, False alarm, Technical fault, Authorised work or Other. Each stage is timestamped, and the activity log records who did what.

**Screens**

| Screen | Route | Permission |
|---|---|---|
| Response Desk: live lanes per stage, response-time timers per card, new-alert chime, average acknowledge and arrival times, real-threat ratio | `/response` | `response.read` |
| Incident drawer: acknowledge, dispatch (same-depot vehicles listed first), recall, record crew progress, close with outcome, timeline | on the Response Desk | `response.acknowledge`, `response.dispatch`, `response.close` |
| Fleet: rapid-response vehicles by depot, with crew lead contacts and status | `/fleet` | `fleet.read` / `fleet.update` |
| Crew page (mobile): Navigate, Accept, Arrived, Close with outcome. No login needed | `/respond/{token}` | link sent at dispatch |

**Crew link.** When a vehicle is dispatched, the crew lead receives an SMS, WhatsApp or email message. It contains the event, the transformer, a Google Maps link and a one-time secure link (192-bit random token). Dispatchers can also copy the link from the drawer and send it by hand.

**Permissions are now enforced by the backend as well as the UI.**
- auth-service sends each user's tick-box permissions in the access profile, and transformer-service turns them into Spring authorities.
- New permissions: `response.read`, `response.acknowledge`, `response.dispatch`, `response.close`, `fleet.read`, `fleet.update`, `control.arm` and `control.disarm`.
- New roles, created only when missing, so your edits are never overwritten: **Contact Centre Agent**, **Dispatcher** and **Loss Control Supervisor**.
- Partner (supplier) accounts get read-only incident visibility through `response.read`.

**Fixes included**
- transformer-service called auth-service on every API request. It now caches each user's access profile for 60 seconds.
- `DataLoader` reset the Oculus partner password to `Password@123` on every restart. It now sets a password only when the account is first created.
- The dashboard map plotted only the first 60 transformers. It now plots all of them: green when online, red when offline, amber when delayed.
- The login page has a rounded logo card, a "subsidiary of ZESA Private Limited" lockup, and honest facts in place of the hardcoded fake statistics.

## Deploy

1. **Database.** The migration is idempotent and additive.
   ```bash
   docker run --rm -i mysql:8.0 mysql -h 192.168.15.228 -uroot -p tms < backend/db-init/20261016_response_lifecycle.sql
   ```
   It converts the Hibernate ENUM status columns to VARCHAR, so the new stages can be stored. It also creates `response_vehicles` and `alert_dispatches`. It was tested twice on MySQL 8.0.46.
2. **Build and restart, in this order:** auth-service, transformer-service, gateway, transformer-frontend.
   ```bash
   docker compose -f docker-compose.live.yml --env-file .env.live build --no-cache auth-service transformer-service gateway transformer-frontend
   docker compose -f docker-compose.live.yml --env-file .env.live up -d auth-service transformer-service gateway transformer-frontend
   ```
3. **Optional crew-link base URL.** It defaults to `http://154.73.80.22`. To change it, add this to `backend/config/transformer-service.properties`, then restart config-server and transformer-service:
   ```properties
   app.public-base-url=https://monitoring.powertel.co.zw
   ```
4. **First use**
   1. Register vehicles under **Fleet**.
   2. Assign the new roles to contact-centre agents and dispatchers under **Users**.
   3. Raise a test alert, dispatch a vehicle to your own phone, and walk through the crew link.

## Verified
- All three services compile with JDK 17 against their own dependency jars: transformer-service, auth-service and gateway.
- The migration ran twice on MySQL 8.0.46, with no errors or changes on the second run.
- `tsc` reports no new errors.
- The `vite build` production build succeeds.
- Screens were rendered with mocked data.

## Roadmap: next phases

1. **Transformer registry**
   - One table of every transformer, with cascading Region → District → Depot filters plus partner, GMT/PMT and online status.
   - Create a transformer from an Oculus EUI lookup, then pick its depot (the lookup has no depot, district or region).
   - Match controllers either automatically (EUI lookup) or manually, from a queue of controllers first seen on the websocket that have no transformer yet.
2. **Contact-centre console**
   - Full-screen alert wall with a map and the newest event on top.
   - Arm/disarm from the incident, permission-gated by `control.arm` and `control.disarm`, with confirmation and audit.
   - Arm/disarm made consistent across web, WhatsApp chat commands and the mobile app.
3. **Dashboards per audience**
   - ZESA/Powertel admin: all partners side by side (online %, open incidents, false-alarm rate per partner).
   - Partner portal: only that partner's transformers across any region.
   - Depot view: its fleet, incidents and response times.
4. **Multi-partner ingest framework**
   - A `SupplierAdapter` interface: one connection (websocket or HTTP) plus one decoder per partner, configured per partner in the database.
   - All adapters emit one normalised event (door / motion / vibration / tamper / keep-alive), so the alert and response flow is the same for every partner.
5. **Gateways**: restyle to match the new look. The functionality stays as it is.
