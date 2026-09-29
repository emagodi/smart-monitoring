# Spec: LORIOT Gateway Monitoring + SIM Inventory (Transformer Anti-Intrusion Platform)

## 1. Problem
Today the platform monitors **controllers + sensors** through LoRaWAN, but the **LoRaWAN gateways** themselves are not modelled or tracked.
Because the only gateway-availability signal today is the *presence or absence of controller uplinks*, any gateway that is administratively online but has no reporting sensors for a few hours is indistinguishable from a gateway that has failed — which is exactly the user's integration note:
> *"Do not use silence on the Application WebSocket as the only proof that a gateway is offline. A gateway can be online while its sensors are not transmitting."*

The system also currently has no SIM inventory, even though the gateways use LTE backhaul, making SIM procurement, assignment, data plan management, and decommissioning completely external, error-prone, and unauditable.

## 2. Users & Goals

| User (role exists today) | Goal |
|---|---|
| Administrator (ZESA / national) | Complete gateway inventory, status, SIM, map coverage, alerting, sync status |
| Depot Foreman / Technician | Local gateway health, SIM swap workflow, location verification |
| Managing / Technical / District Director | High-level gateway KPI overview and recent outages |
| Monitoring Operator (read-only) | Status visibility, map, activity, no changes |
| Auditor | Change history of gateway status + SIM assignments + sensitive reveals, no edits |
| Supplier user (Oculus etc.) | No gateway / SIM access — assets are network-level not per-supplier |

## 3. Goals (in-scope)
1. Model **LoRaWAN gateways as first-class assets** with status history, location, identifiers, relationships, and audit fields.
2. Build a clean **LORIOT adapter layer** inside `transformer-service` that isolates the two integration paths the user explicitly specified:
   - `Application WebSocket` — retain existing use (sensor/controller uplinks + decoded payloads); **add gateway metadata extraction** (EUI, rx metadata) when present.
   - `User API (REST)` — **NEW:** periodic authoritative gateway inventory sync + status polling, with manual sync action.
   - `Gateway event notification endpoint` — **NEW:** protected HTTPS webhook for push notifications from LORIOT account-level feature.
3. Implement a **status engine with priority hierarchy** that never calls a gateway OFFLINE based on silence alone; authoritative LORIOT status and notifications always win.
4. Build a **reusable SIM card inventory** with lifecycle, slot-based gateway assignment history, encrypted PIN/PUK, masked-by-default sensitive values, and auditable reveals.
5. Provide **REST APIs** for both modules with pagination, filters, CRUD, sync actions, and consistent authorization.
6. Add **frontend UI** consistent with existing Powertel blue/red/white enterprise design:
   - Sidebar entry under **Assets** for Gateways; SIM Management under Assets (no Material-UI introduced).
   - Summary cards, table with status + identifiers + last seen + SIM, filters, detail modal/drawer sections.
   - Interactive gateway status **map** (reuse `GoogleAssetMap.tsx`).
   - **Dashboard KPIs** (realtime gateway counts, requiring attention list, outages).
7. **Secrets handling:**
   - LORIOT `APPLICATION_ACCESS_TOKEN` and `USER_API_KEY` are **backend-only env vars**. They are **never** sent to React, never logged, never appear in DTOs.
   - The user API key shown in the prompt (`...sKgc`) is treated as a deployment **secret to configure in env only**; it is not hardcoded anywhere.
8. Backward compatibility: every existing transformer/sensor/alert decoder path continues to work unchanged.

## 4. Non-Goals (explicitly out-of-scope for this phase)
- Replace the LORIOT application WebSocket connection already used for uplinks.
- Add downlink commands through the new gateway adapter (keep controller arm/disarm via current `OculusControl` flow).
- Implement SMS/data-usage polling from the mobile operator (LTE SIM data planes are an inventory-only concern in this phase).
- Add unit tests or integration tests; production code remains testable and a later test phase is documented in the delivery section.
- Introduce Flyway/Liquibase (migration engine unchanged; Hibernate `ddl-auto=update` as per existing project convention; permissions still seeded through `DataLoader`).
- Re-use any non-existent entities: the discovery confirmed no `Customer`, `Site` JPA entities; Gateway location/customer relationships use existing Depot/District/Region IDs plus a nullable `customer` String field for phase 1.

## 5. Functional Requirements (FR)

### 5.1 LORIOT Adapter Layer (transformer-service)
- FR-A1: A single `LoriotClientAdapter` bean encapsulates both: (a) User API REST calls, (b) Gateway event webhook parsing and validation.
- FR-A2: `LoriotClientAdapter` reads its configuration exclusively through `@Value` / Spring properties:
  - `loriot.base-url` (default `https://lorawan.powertel.co.zw`)
  - `loriot.websocket.url` (existing)
  - `loriot.application.access-token` — injected from env `LORIOT_APPLICATION_ACCESS_TOKEN`
  - `loriot.user.api-key` — injected from env `LORIOT_USER_API_KEY` (value `…sKgc` in env only)
  - `loriot.network-id` (default `A0000005`)
  - `loriot.gateway-sync-interval` ISO-8601 Duration, e.g. `PT5M`
  - `loriot.notification-secret` — bearer token to protect webhook endpoint
- FR-A3: User API REST calls are **read-only by design** (only `GET`), bounded retry with exponential backoff on 5xx/connection errors, with a circuit-breaker-like guard (no piling calls when remote failing).
- FR-A4: Webhook endpoint `POST /internal/integrations/loriot/gateway-events` requires header `Authorization: Bearer <loriot.notification-secret>`. Returns 401 if missing/invalid, 400 if payload cannot be parsed, 202 accepted when event queued.

### 5.2 Gateway Synchronization Service
- FR-S1: On service startup after application context ready → run initial **full sync** (non-blocking, async).
- FR-S2: Scheduled incremental sync at the configurable interval; never run if a sync is already in flight (debounced).
- FR-S3: Authorized manual action endpoint `POST /api/v1/gateways/sync` triggers immediate sync (returns 202 with scheduled run id).
- FR-S4: Upsert strategy per gateway record using this ordered natural key match:
  1. `loriotGatewayId` (exact match — LORIOT internal gateway id)
  2. `normalizedGatewayEui` (`gatewayEui.toLowerCase().replaceAll("[^a-f0-9]","")`)
  3. `normalizedMac` (same, from MAC)
- FR-S5: Normalization never overwrites the display values, only adds lookup columns. Duplicates due to `:` / `-` / case never created.
- FR-S6: Manual fields (coordinates, address, depot/district/region, customer, notes, SIM) are **never overwritten** by blank/NULL LORIOT values, only when LORIOT value is non-null non-empty AND manual field is currently null/empty OR the sync explicitly decides to replace the authoritative side (LORIOT values overwrite empty admin fields, never the other way).
- FR-S7: One failed sync must **never** mark all gateways OFFLINE or delete rows.
- FR-S8: `GatewaySyncRun` record written for every execution; contains `startedAt`, `finishedAt`, `status` (RUNNING, SUCCESS, PARTIAL, FAILED), `errorSummary` (truncated, no secrets), counts `created`, `updated`, `unchanged`, `failed`.

### 5.3 Gateway Status Engine
- FR-ST1: Every gateway persistently stores these fields (separately, never mixed):
  - `loriotReportedStatus` (string: ONLINE / OFFLINE / null from API response)
  - `computedStatus` — engine result before alert grace-period override
  - `effectiveStatus` — the status surfaced to REST + UI
  - `lastLoriotSeenAt` (last time authoritative LORIOT data said it was online)
  - `lastTrafficSeenAt` (last time we observed ANY uplink with this gateway EUI in rx metadata, or via notification)
  - `lastHealthCheckAt` (last sync or heartbeat success timestamp)
  - `statusChangedAt` (when effectiveStatus last changed to a different enum)
  - `statusReason` (free-text explaining current effectiveStatus + source)
- FR-ST2: Priority of signals:
  1. FRESH LORIOT-reported status → governs
  2. Authenticated gateway notification / heartbeat → immediate transition
  3. Recent uplink rx metadata (`lastTrafficSeenAt` younger than threshold) → confirms gateway alive, prevents OFFLINE based purely on staleness
  4. Nothing reliable → `UNKNOWN` (never invent ONLINE or OFFLINE)
- FR-ST3: Status enum: ONLINE | DEGRADED | OFFLINE | NEVER_SEEN | UNKNOWN
- FR-ST4: Grace period before raising OFFLINE alert (configurable `gateway.offline-grace = PT10M`). If gateway comes back online within grace, alert is auto-resolved.
- FR-ST5: Only status transitions where `(prevStatus != newStatus)` are inserted into `GatewayStatusHistory`. Never insert duplicate rows with identical status.

### 5.4 Gateway Data Model
- FR-G1: `Gateway` fields (Hibernate-managed DDL as per project convention):
  identifiers: id (PK auto), loriotGatewayId (unique), networkId, name, description, gatewayEui, normalizedGatewayEui (unique), macAddress, normalizedMac, serialNumber, imei, manufacturer, model, firmwareVersion, packetForwarderVersion,
  statuses/timestamps per FR-ST1,
  sync metadata: lastSyncRunId, lastSyncAt,
  location: latitude, longitude, altitude, address, locationSource (`LORIOT`/`GPS`/`MANUAL`/`IMPORTED`/`UNKNOWN`), locationVerified, locationVerifiedAt, locationVerifiedBy,
  relationships: customer (String for phase 1), regionId (Long), districtId (Long), depotId (Long), siteId (Long nullable for future),
  commissioning: commissioningDate, decommissioned, decommissionedAt, decommissionedReason,
  audit: createdBy, createdAt, updatedBy, updatedAt (same pattern as existing entities: transformer-service inline annotations, no createdBy yet — added for gateway/SIM only),
  optimistic locking: @Version Long version.
- FR-G2: `GatewayStatusHistory`: id, gateway_id FK, prevStatus, newStatus, reason, source (`LORIOT_API`/`LORIOT_NOTIFICATION`/`UPLINK_TRAFFIC`/`SYNC`/`MANUAL`/`SYSTEM`), observedAt (Instant).
- FR-G3: `GatewayTransformerCoverage` (optional join): id, gateway_id FK, transformer_id FK, notes, unique(gateway_id, transformer_id).
- FR-G4: Unique constraints: `uk_gateways_loriot_gateway_id` on (loriotGatewayId), `uk_gateways_normalized_gateway_eui` on (normalizedGatewayEui).
- FR-G5: Gateways are not forced into 1:1 with a transformer; 1 gateway can cover N transformers.

### 5.5 SIM Inventory and Assignment
- FR-SIM1: `SimCard` fields: id (PK), msisdn, iccid (unique normalized), imsi (unique normalized), operator, apn, encryptedPin (encrypted at rest by application, NOT plaintext), encryptedPuk (same), status enum (AVAILABLE/ASSIGNED/ACTIVE/SUSPENDED/LOST/DAMAGED/EXPIRED/DECOMMISSIONED), dataPlanGb, allowanceGb, activationDate, expiryDate, notes, audit, @Version.
- FR-SIM2: `GatewaySimAssignment`: id, gateway_id FK, sim_id FK, slotNumber (default 1), assignedAt, unassignedAt, assignedBy, unassignedBy, reason, notes, active flag (boolean).
- FR-SIM3: At most 1 active SIM per SimCard (`uk_active_sim_one` partial or app-enforced if MySQL lacks that). One gateway has exactly 1 active primary SIM by default; gateway model intentionally supports multi-slot extension (slotNumber).
- FR-SIM4: Assigning a replacement SIM is one transaction: set previous.active=false + insert new.active=true.
- FR-SIM5: PIN/PUK never logged, never returned in standard DTOs, masked `****` except when a user has `SIM_VIEW_SENSITIVE` permission and explicitly calls reveal endpoint (audit row written).

### 5.6 Backend REST API (consistent prefix `/api/v1/` like sibling controllers)
- FR-REST1: Gateway CRUD (paginated, filterable, sortable, DTO validated, permission protected):
  - `GET  /api/v1/gateways` with query params: page, size, status, search (name/EUI/MAC/serial), customer, regionId, districtId, depotId, networkId, model, operator, hasLocation (bool), hasSim (bool), lastSeenFrom, lastSeenTo, sortBy, sortDir.
  - `GET  /api/v1/gateways/{id}`
  - `POST /api/v1/gateways` create manual (non-LORIOT-registered) gateway record
  - `PUT  /api/v1/gateways/{id}` update manual fields, never overwrite LORIOT identifiers or status directly (use MANUAL status reason)
  - `POST /api/v1/gateways/sync` authorized manual sync (FR-S3)
  - `GET  /api/v1/gateways/sync/status` last N runs + overall status
  - `GET  /api/v1/gateways/{id}/status-history` paginated
  - `GET  /api/v1/gateways/map` returns gateway map points with lat/lng and effective status; strips all secrets
  - `GET  /api/v1/gateways/summary` counts by enum + missingLocation, missingSim, sync status.
- FR-REST2: SIM CRUD + assign/unassign:
  - `GET  /api/v1/sim-cards` page+filter (msisdn/iccid/imsi/operator/status/assigned), mask sensitive fields
  - `GET  /api/v1/sim-cards/{id}`
  - `POST /api/v1/sim-cards` create
  - `PUT  /api/v1/sim-cards/{id}`
  - `POST /api/v1/sim-cards/{id}/reveal-sensitive`  (audit, needs SIM_VIEW_SENSITIVE) — returns pin/puk once in response
  - `POST /api/v1/gateways/{gatewayId}/sim-assignments` with simId + slotNumber + reason (transactional)
  - `DELETE /api/v1/gateways/{gatewayId}/sim-assignments/{assignmentId}` unassign with reason
  - `GET  /api/v1/gateways/{gatewayId}/sim-assignments` history

### 5.7 Permissions & Auditing
- FR-P1: New fine-grained permission strings (module=action style, same pattern as DataLoader):
  - `gateways.view, gateways.create, gateways.edit, gateways.sync, gateways.assign_customer, gateways.update_location`
  - `gateways.audit_view`
  - `sims.view, sims.create, sims.edit, sims.assign, sims.unassign, sims.view_sensitive`
- FR-P2: `Administrator` role → all permissions granted.
- FR-P3: Backend `@PreAuthorize` on every endpoint (consistent mix of hasAuthority or legacy READ_PRIVILEGE + hasAnyRole with `ADMINISTRATOR` also listed, fixing the transformer-service gap for DB-backed role names).
- FR-P4: Audit events (via the existing logging framework at INFO, no separate audit DB unless trivially added) emitted for:
  - Gateway create/update/decommission, location update, customer assignment, manual sync request, reveal events.
  - SIM create/update/status change, assign, unassign, reveal-sensitive.
  - Audited before/after snapshots exclude PIN/PUK/secrets.

### 5.8 Frontend Gateway Experience
- FE-1: Add `Gateways` and `SIM Cards` nav items under **Assets** in [AppSidebar.tsx](file:///c:/Users/Edwin%20Magodi/Desktop/Projects/smart-monitoring/frontend/src/layout/AppSidebar.tsx), permissions `gateways.view` / `sims.view`, `hideForSupplier=true`.
- FE-2: Routes in [App.tsx](file:///c:/Users/Edwin%20Magodi/Desktop/Projects/smart-monitoring/frontend/src/App.tsx): `/gateways`, `/sims`, both via `<ProtectedRoute permission="…" disallowSupplier>`.
- FE-3: Gateway summary cards (same card style as the existing lightweight StatCard in dashboard): Total / Online / Offline / Degraded / Never Seen / Unknown / Missing Location / Missing SIM / LORIOT Sync Status (9 KPI cards total, 3 rows).
- FE-4: Gateway compact enterprise table (same pattern as Alerts table): status pill · name · customer · GWEUI (masked except admin?) · MAC · serial · model · network · assigned MSISDN (masked) · site / depot · last seen · last sync · actions column with tiny pill buttons 11px: `Details` (opens modal) + `Edit` + `Sync Now` (if gateways.sync).
- FE-5: Filters row: status multiselect pill buttons + search box + customer/region/district/depot/network/model/operator selects + location present SIM assigned toggles + date range picker for last seen.
- FE-6: Gateway detail modal (consistent, non-fullscreen, like Alerts detail used in previous work): tabs Overview / Identifiers / Connectivity / Location / Associations (transformers) / SIM / Activity (status history).
- FE-7: Map page section (within Gateways page): reuse `GoogleAssetMap.tsx` via wrapper; color markers by `effectiveStatus` (online=green, offline=red, degraded=amber, never_seen=grey, unknown=slate), single-legend inline at top, marker popup shows gateway name, status, masked identifier, masked mobile if SIM assigned, last seen, transformer count, `Open Detail →` link.
- FE-8: Missing location list in gateways page side tab: list of gateways with invalid lat/lng, 1-click "copy coordinates from depot" for admins.
- FE-9: Dashboard integration — Add gateway KPI mini-cards (only when heavy section loaded) plus 3-card requiring attention list (Offline / Degraded / Missing SIM) in dashboard's supplier panel; when clicked navigates to gateways pre-filtered.

### 5.9 Frontend SIM Experience
- SIM-S1: Summary cards (Total / Available / Active / Suspended / Missing Assignment / Expiring Soon)
- SIM-S2: Compact table with masked ICCID / IMSI / MSISDN by default, Reveal action requires `sims.view_sensitive`.
- SIM-S3: Assign/Unassign flow via modal consistent with gateway SIM tab; transactional through the API.

## 6. Non-Functional Requirements
- NFR-1 (Security) Rule: LORIOT tokens and SIM PIN/PUK are never serialized to React, never logged, never stored unencrypted, never appear in error messages.
- NFR-2 (Performance) Rule: Gateway list and map paginate server-side; gateways/map endpoint never returns > 500 rows for map; dashboard 9-card summary uses 1 REST call (single SQL aggregated query under the hood).
- NFR-3 (Resilience) Rule: When LORIOT REST API is unavailable for > 1 sync, gateway UI shows the last known effective status clearly and a banner "LORIOT sync delayed" but continues to operate locally (no full-page failures, no blank tables, existing data available).
- NFR-4 (Performance) Rubric: On a local machine with < 500 gateways, initial dashboard paint < 2s after login (fast stat path), Gateways page table paint < 2s (paginated REST).
- NFR-5 (Compatibility) Rule: All existing endpoints (transformers, controllers, sensors, sensor readings, alerts, oculus-control, websocket liveness) must remain unchanged and passing previous behaviour.
- NFR-6 (Scope) Rule: 100% of new backend code runs inside `transformer-service` (auth-service only gets updated DataLoader permission seed for gateways/sims). No new microservice container added.
- NFR-7 (Style) Rule: Frontend 100% consistent with current blue/red/white enterprise blushed cards, tiny 11px pill buttons, enterprise table styling, no side-by-side stacked vertical waste.

## 7. Constraints, Dependencies, Assumptions
- C-1: Secrets. `LORIOT_USER_API_KEY` = AAAADQWSmNs6bWJxjIaWjMlqCZ553sp3BYAOwggUhB76Bi7Co is a deployment secret. Code references it exclusively as `${LORIOT_USER_API_KEY:}` placeholder through Spring env. Never hardcoded.
- C-2: Deployment environment variables (user-specified names exactly): `LORIOT_BASE_URL`, `LORIOT_WEBSOCKET_URL`, `LORIOT_APPLICATION_ACCESS_TOKEN`, `LORIOT_USER_API_KEY`, `LORIOT_NETWORK_ID`, `LORIOT_GATEWAY_SYNC_INTERVAL` (ISO-8601 duration, e.g. `PT5M`), `GATEWAY_OFFLINE_THRESHOLD_MINUTES`, `LORIOT_NOTIFICATION_SECRET`.
- C-3: LORIOT v8.1.22 API exact paths: Swagger discovery required at runtime / against provided Swagger page. Implementation calls the **redacted Swagger endpoint paths** supplied by the user, not invented paths. If not supplied, adapter uses:
  - GET `/1/nwk/gateways` for network A0000005 list as first candidate, with fallback paths `/api/network/{networkId}/gateways`; actual call abstracted so path can be overridden via property if it differs on `lorawan.powertel.co.zw`.
- C-4: The current LORIOT WebSocket message fields used are listed per the discovery (cmd/type, EUI, port, data). The existing decoder is untouched; only an ADDITIONAL extraction runs to capture gateway EUI/rx metadata from `gws`/`rxq` when present (today code does not read these fields, so engine begins with null traffic metadata).
- C-5: Migration engine remains Hibernate ddl-auto=update. There are no Flyway/Liquibase to add. Permissions are seeded by `DataLoader#run`.
- A-1 (Assumption): The `User` API (key management screenshot) uses bearer token authorization `Authorization: Bearer <LORIOT_USER_API_KEY>`. If actual auth scheme differs (e.g. custom header `Authorization: userkey <key>`) the adapter allows overriding header pattern via `loriot.user-api-auth-pattern: "Bearer {}"`.
- A-2: `Network ID A0000005` is string (hex-like).

## 8. Open Questions (answered by code-time defaults; no user blocking if these default)
- OQ-1: Which endpoint paths exactly does the private Swagger expose for network A0000005 gateway list, single gateway detail, gateway events? → Defaults applied, overridable via properties (`loriot.path.gateways`, `loriot.path.gateway-detail`, `loriot.path.gateway-events`).
- OQ-2: Is there a per-gateway location source from LORIOT (GPS coordinates)? → If present, store with `locationSource=LORIOT`; if not, do not invent coordinates, keep NULL.
- OQ-3: Gateway notification license feature availability. If webhook unavailable, scheduled sync remains fallback.

## 9. Acceptance Criteria

All ACs are type `rule` (pass/fail, objectively verifiable) or `rubric` (evaluative scale with threshold).

### Business & User
- AC-1 (rule): Admin can navigate to `/gateways`, see summary KPI cards, a paginated gateway table, and an interactive map showing each gateway with valid coordinates. `(0,0)` default coordinates are filtered from map mapPoints if explicitly marked missing.
- AC-2 (rule): Admin can manually trigger LORIOT sync via button on Gateways page (`Sync Now` pill or button). Returns 202, increments counter `created/updated/unchanged` visible on sync status panel. Existing gateways NOT deleted / mass OFFLINE-marked if sync request errors.
- AC-3 (rule): Gateway status correctly reflects priority order — LORIOT ONLINE reported via API → effectiveStatus = ONLINE even if no uplinks recently; uplink rx metadata alone does NOT mark a gateway offline if API missing; absent signals only yields UNKNOWN.
- AC-4 (rule): Supplier users (supplierCode set) cannot see Gateways or SIM menu items, routes, or API endpoints (API returns 403; sidebar hides them; route redirects to /dashboard).
- AC-5 (rule): SIM PIN and PUK are masked `****` in every list/detail response unless the authenticated user has `sims.view_sensitive` and explicitly calls the reveal endpoint, which writes an audit log entry including the actor, sim id, timestamp, and NOT the actual pin/puk.
- AC-6 (rule): LORIOT application access token, user API key, and notification secret never appear in any DTO, response body, console log line, or Spring actuator env endpoint.
- AC-7 (rule): After implementation the project builds. Backend: `mvn -DskipTests compile` passes for both auth-service and transformer-service. Frontend: `npm run build` passes.
- AC-8 (rule): Local Docker stack starts cleanly with the new changes (`docker compose up -d --build --remove-orphans transformer-service auth-service transformer-frontend`) and no container exits < 30s due to Spring errors.

### Data & API
- AC-9 (rule): Unique normalization uniqueness rule enforced: two LORIOT records differing only in EUI colons / MAC hyphens / case land in one row (upserted correctly not duplicated).
- AC-10 (rule): Manual admin edits (e.g. address, verified coordinates, depot assignment) are not overwritten by the next sync when that field comes NULL from LORIOT.
- AC-11 (rule): `GatewayStatusHistory` contains exactly one row per effective status change. Repeated identical transitions do not accumulate duplicate rows.
- AC-12 (rule): `gateways/map` endpoint returns only points with valid finite lat/lng and NO secrets (only id, name, effectiveStatus, masked msisdn if SIM, lastSeenAt truncated ISO, depotId if present).
- AC-13 (rule): SIM assignment is transactional: if I assign SIM B to gateway X while SIM A is active, SIM A active flag becomes false + SIM assignment closed row + new SIM B active row inserted in same successful call, not partial.

### Code Quality / Architecture
- AC-14 (rule): A clean `loriot` package inside transformer-service isolates ALL LORIOT-specific code (adapter, client, sync, properties, notification, mapper). Controllers, entities, services reference this package; LORIOT-specific OkHttp / Jackson code never appears inline in a controller or unrelated entity.
- AC-15 (rubric, threshold ≥ 3 of 4): **Design adaptability** — how easy is it to swap user API paths / add a future network: 4 = all external URLs/header patterns in one `@ConfigurationProperties` class, HTTP calls centralized; 3 = paths are properties but auth header pattern partially hardcoded; 2 = URLs partially hardcoded; 1 = magic strings everywhere.
- AC-16 (rubric, threshold ≥ 3 of 4): **Performance predictability** (NFR-4): 4 = DB queries indexed where needed (EUI, status, last-seen), API response times consistently < 500 ms for typical page 1; 3 = occasional > 800 ms peaks but dashboard < 2s; 2 = dashboard > 4s but usable; 1 = repeated multi-second freezes on dashboard or gateway page load.
- AC-17 (rule): Every `@PreAuthorize` gateways/sims endpoint includes the NEW fine-grained permission string `AND (hasAuthority('READ_PRIVILEGE') OR hasAuthority('role-legacy') OR hasRole('ADMINISTRATOR'))` so that both the new Administrator role and any user with legacy privileges can operate; gateway create/edit/delete endpoints disallow supplier users on service side (not just frontend).
- AC-18 (rule): Permissions are seeded on the next `auth-service` startup via DataLoader: Administrator role receives all new gateway/sim permissions, Supplier Administrator role receives NONE (supplier excluded from gateway/sim by default).

## 10. Evidence & Validation Instructions for Reviewer
- Build verification commands:
  Backend: `cd backend/auth-service ; mvn -q -DskipTests compile` then `cd backend/transformer-service ; mvn -q -DskipTests compile`
  Frontend: `cd frontend ; npm run build`
- Docker local startup: `docker compose up -d --build --remove-orphans`
- Manual smoke tests:
  1. Login as `emagodi1@powertel.co.zw` (Administrator):
     - Gateways & SIM items appear in sidebar under Assets
     - Navigate to `/gateways` and `/sims` — pages render
     - Click Sync Now (endpoint returns 202)
     - Click a gateway to open detail modal tabs
     - `/api/v1/gateways/summary` returns valid JSON
  2. Login as supplier `magodi@oculus.co.zw`:
     - No Gateways / SIM nav items visible
     - Direct URL `/gateways` redirects to dashboard
     - `/api/v1/gateways` returns 403
  3. Secrets leak smoke: search build output and API response bodies for the 4-digit tail `sKgc` — no matches except in env placeholder comments.
