# Registry, console controls, insights and supplier ingest: release notes

This release builds on the response lifecycle in `RESPONSE_LIFECYCLE_RUNBOOK.md`. Deploy that release first if it is not live yet.

## 1. Transformer registry (`/transformers`)
- **One table of every transformer.** Each row shows type (GMT/PMT), Region › District › Depot, partner, device EUIs, live status, arm state and open alerts.
  - Status is Online (≤ 15 min), Delayed (≤ 30 min), Offline, Never seen, or No device.
  - The data comes from one grouped query: `GET /api/v1/transformers/registry`.
- **Filters.**
  - Region → District → Depot cascade.
  - Partner, GMT/PMT, status chips and search.
  - Filters are kept in the URL, so filtered views can be shared.
  - CSV export of the current view.
- **Add from device EUI.**
  - Looks the EUI up at the partner (`GET /api/v1/transformers/import-eui/preview?eui=`) and shows whether we already hear the device.
  - Suggests a depot from the transformer name. You confirm Region → District → Depot.
  - Creates the transformer and links the controller: `POST /api/v1/transformers/import-eui`.
- **Unmatched controllers tab.**
  - Lists devices that the partner feeds auto-registered but that have no transformer yet (`GET /api/v1/controllers/unmatched`).
  - For each one, either create a new transformer from its EUI, or link it to an existing transformer (`POST /api/v1/controllers/{id}/assign`).
- The old screen is still available at `/transformers/classic`.

## 2. Contact-centre console: arm/disarm everywhere
- **Incident drawer.** Each incident now has a **Site controller** panel. It shows online status and the last arm/disarm, and offers Arm / Disarm with a confirmation step. The command is written to the incident timeline (`?alertId=`).
- **One rule for every channel:** `control.arm` and `control.disarm`, or Administrator.
  - **Web:** enforced on `POST /api/v1/oculus-control/transformers/{id}/arm|disarm`.
  - **WhatsApp chat commands:** previously any user with the basic `USER` role could arm or disarm. Now the user needs the matching permission for that action.
  - **Mobile:** the mobile app does not arm or disarm today. When that is added, it should call the same web endpoint, which inherits the same rule.
- **Before you deploy:** give `control.arm` / `control.disarm` to everyone who uses WhatsApp control today.
  - Administrator, Contact Centre Agent, Dispatcher and Supplier Administrator already have them.
  - Any other role needs them ticked on the Roles screen.

## 3. Insights (`/insights`)
- **ZESA/Powertel (national):**
  - KPI row.
  - Partner comparison cards: device health bar, online %, open incidents, real threats, false-alarm %, average arrival time, unmatched devices.
  - Sortable depot table with region filter, showing device health, incidents, real threats, arrival time and free vehicles.
- **Partner portal:** a partner account sees the same page, scoped to its own transformers in any region. The title reads "Oculus portal".
- **Depot users:** see their depot only.
- Endpoint: `GET /api/v1/transformers/overview`.

## 4. Supplier ingest framework (`/integrations`)
- **One row per partner feed:**
  - LORIOT application websocket (we connect), or HTTP push (the partner posts to `/api/v1/public/ingest/{id}` with `X-Integration-Key`).
  - Each feed has its own decoder.
  - Changes apply within 30 seconds, with no restart.
- **Decoders included:**
  - `dragino-lt22222`: the Oculus devices. The legacy Oculus ingestor now uses this same code.
  - `json-fields`: for partners whose LORIOT app or HTTP push already sends `door` / `motion` / `vibration` fields.
  - To add a new device family, add one Java class implementing `UplinkDecoder`.
- **Shared pipeline (`TelemetryPipeline`):**
  - Every feed goes through it.
  - It de-duplicates LORIOT's paired `gw`/`rx` messages.
  - It auto-registers unknown devices into the Unmatched queue.
  - It feeds the existing alert engine, so every partner gets identical alerts, dispatch and outcomes.
- **Decoder test bench:** paste a payload and see exactly what the platform will read.
- **Oculus migration (optional, later):**
  1. The migration seeds a *disabled* Oculus row.
  2. Paste the LORIOT app URL into it and enable it.
  3. Clear `OCULUS_WS_URL`, the legacy ingestor.
  - While the legacy URL is set, the framework will not open the Oculus feed, so messages are never ingested twice.

## Deploy
1. **Database:**
   ```bash
   docker run --rm -i mysql:8.0 mysql -h 192.168.15.228 -uroot -p tms < backend/db-init/20261017_registry_integrations.sql
   ```
2. **Build and restart:** auth-service, transformer-service, gateway, transformer-frontend.
3. **Roles:** tick `integrations.read` / `integrations.manage` for whoever onboards partners. Administrator gets them automatically. Also tick `control.arm` / `control.disarm` where needed.

## Verified
- transformer-service, auth-service and gateway compile with JDK 17 against their own dependency jars.
- The migration ran twice on MySQL 8.0.46, as a no-op the second time. The registry, unmatched-queue and insights queries ran on the same server.
- Decoders were checked against the real Oculus sample uplink from the unit test, plus a pre-decoded JSON sample.
- `tsc` reports no new errors, and the `vite build` production build succeeds.
- All screens were rendered against mocked APIs.
- Fixed in passing: two Alerts-page grids used comma syntax inside Tailwind arbitrary values, so those layouts were not applied.
