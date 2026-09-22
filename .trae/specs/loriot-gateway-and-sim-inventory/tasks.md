# Tasks: LORIOT Gateway Monitoring + SIM Inventory

**Parent Spec**: [spec.md](file:///c:/Users/Edwin%20Magodi/Desktop/Projects/smart-monitoring/.trae/specs/loriot-gateway-and-sim-inventory/spec.md)
**Implementation boundary**: auth-service (permission seeds only) + transformer-service (LORIOT adapter, entities, sync/status engine, REST) + frontend (sidebar, routes, pages).
**Stop conditions**: Every task Status == completed/cancelled (with explicit approval) AND every AC has at least one TR with passing evidence AND Spec Mode reviewer sign-off.

---

## Task 1: Permission seed for Gateways + SIM modules (auth-service DataLoader)
- **Status**: pending
- **Priority**: high
- **Owner**: implementer
- **Depends on**: none
- **Scope**: Single file edit. Update `DataLoader` in [DataLoader.java](file:///c:/Users/Edwin%20Magodi/Desktop/Projects/smart-monitoring/backend/auth-service/src/main/java/com/safalifter/authservice/config/DataLoader.java) module+action list to add:
  - Module `gateways` → actions `view, create, edit, sync, assign_customer, update_location, audit_view`
  - Module `sims` → actions `view, create, edit, assign, unassign, view_sensitive`
- **Grant**:
  - "Administrator" (all privileges): grant every new permission (same bulk `findAll()` pattern used for existing admin set)
  - "Supplier Administrator": grant none (suppliers excluded from gateway/sim).
- **Coverage**: AC-17, AC-18.
- **Task-local Test Requirements (TR)**:
  - TR-1.1 (rule, maps AC-18): Start auth-service; hit Permissions API page as admin → new permission strings `gateways.view`, `sims.view_sensitive` etc. all present and assigned to Administrator role. Evidence: HTTP response JSON includes permission names.
  - TR-1.2 (rule, maps AC-4): Supplier Administrator permissions list does NOT include any gateways.* or sims.* string. Evidence: `AuthenticationResponse.permissions` array for supplier user contains zero matches for `gateways.` or `sims.`.

---

## Task 2: Backend entities + repositories (Gateway, Status History, Sync Run, SimCard, Assignment, Coverage)
- **Status**: pending
- **Priority**: high
- **Owner**: implementer
- **Depends on**: Task 1 (optional, concurrent-safe)
- **Scope**: transformer-service `entities/` + `repositories/`
  - `Gateway` entity (per FR-G1): @Table(name = "gateways") with unique constraints on `loriotGatewayId` and `normalizedGatewayEui` plus indexes on status, regionId, depotId, lastTrafficSeenAt, lastLoriotSeenAt. BigDecimals for lat/lng/alt. @Version Long version.
  - `GatewayStatusHistory` entity (FR-G2): composite fields prevStatus/newStatus reason/source/observedAt.
  - `GatewaySyncRun` entity (FR-S8): enum status RUNNING/SUCCESS/PARTIAL/FAILED, errorSummary (varchar 2000), counts created/updated/unchanged/failed.
  - `SimCard` entity (FR-SIM1): normalizedIccid/normalizedImsi columns with column uniques; encryptedPin/encryptedPuk stored as Base64 string after application-level AES-GCM encryption using a property-configured key (`sim.encryption.key`) + random nonce (never store in plain). mask helper in service layer.
  - `GatewaySimAssignment` entity (FR-SIM2): active flag, slotNumber default 1.
  - `GatewayTransformerCoverage` entity (FR-G3): bridge table many-to-many.
  - Spring Data `JpaRepository` interfaces for all.
- **Coverage**: FR-G1..FR-G5, FR-SIM1..SIM4, AC-9, AC-11, AC-13, NFR-2.
- **Task-local Test Requirements (TR)**:
  - TR-2.1 (rule, maps AC-9): Insert 2 rows into gateway table where EUI = "AA:BB:CC:DD:EE:FF:00:11" and "aabbccddeeff0011" in two sequential sync runs; rows.count() == 1. Evidence: repository count query returns 1.
  - TR-2.2 (rule, maps FR-G4 via schema): Spring Boot startup logs do NOT show "ERROR: Duplicate column name" or "Unique index or primary key violation" for gateways uk_* constraints on fresh DB.
  - TR-2.3 (rule, maps AC-11): Update gateway A effectiveStatus from ONLINE → OFFLINE → OFFLINE → ONLINE over 3 calls via status engine; GatewayStatusHistory rows == 2 (ONLINE→OFFLINE, OFFLINE→ONLINE). Duplicate write dropped.
  - TR-2.4 (rule, maps AC-13): Insert SIM + Assignment; call replace-same-gateway transaction endpoint; GatewaySimAssignment.findBySimIdAndActive(prevSimId,true).count == 0 AND new Sim active.count == 1.

---

## Task 3: LORIOT ConfigurationProperties + REST User API Adapter (Client)
- **Status**: pending
- **Priority**: high
- **Owner**: implementer
- **Depends on**: Task 2 repositories ready or concurrent (repositories not used in client itself)
- **Scope**: transformer-service package `com.safalifter.transformerservice.integration.loriot`:
  - `LoriotProperties.java` @ConfigurationProperties(prefix = "loriot"): all env vars.
  - `LoriotClientAdapter` bean: Spring `RestClient` or RestTemplate + Jackson, configurable paths for network list, gateway list, gateway detail endpoints.
  - Exponential retry + backoff for 5xx/connect errors (Spring Retry if already a dep; otherwise simple bounded 3-retry with Thread.sleep pattern inside client).
  - `LoriotGateway` DTO to deserialize responses: fields name/gweui/mac/serial/model/fw version/online status last seen lat/lng etc as loose Map-backed DTO (avoids hard-failing on unknown fields). When response structure not known, use JsonNode for leniency.
- **Credential handling**: client never logs Authorization header; `@ToString.Exclude` on secrets fields; debug logging body suppressed via `objectMapper.writerWithoutDefaultPrettyPrinter()` + redaction when printing.
- **Coverage**: FR-A1..FR-A3, FR-A2 env vars, C-1, C-3, A-1, AC-6, AC-14, AC-15.
- **Task-local Test Requirements (TR)**:
  - TR-3.1 (rule, maps AC-6 & C-1): Grep built transformer-service JAR strings / compile-time constants + all DTO fields for `…sKgc` literal → zero matches.
  - TR-3.2 (rule, maps FR-A3): Throttle/override client factory with mock 5xx responder → client retries at least 2x before failing, never enters infinite loop; max runtime bounded.
  - TR-3.3 (rubric, maps AC-15, threshold 3/4): code inspection of properties class: `@ConfigurationProperties` exists with prefix loriot, all paths URLs, auth header patterns configurable there; score 4 if header format pattern uses placeholder "{}" too; score 3 if URLs configurable but auth format hardcoded "Bearer <key>"; score 2 if URLs partially hardcoded.

---

## Task 4: LORIOT Gateway Synchronization Service (sync + upsert + safe dedup)
- **Status**: pending
- **Priority**: high
- **Owner**: implementer
- **Depends on**: Task 2 (repos + entities) + Task 3 (client adapter)
- **Scope**: `LoriotGatewaySyncService` in transformer-service:
  - `@EventListener(ContextRefreshedEvent.class)` async initial sync; `@Scheduled(fixedDelayString = "${loriot.gateway-sync-interval-ms:300000}")` incremental with `AtomicBoolean inProgress` to avoid overlapping schedules.
  - `triggerManualSync()` endpoint hook, returns `GatewaySyncRun.id`.
  - `normalizeIdentifiers()` helper: lowercase, strip `[^a-f0-9]` for EUI and MAC/MAC-48 (colon/hyphen/dot/space removed).
  - Upsert strategy (FR-S4): exact loriotGatewayId find first; else normalizedEui find; else normalizedMac find; else new.
  - Manual-field protection (FR-S6): diff current vs incoming LORIOT fields. For each LORIOT-null field, retain stored value. For each LORIOT-non-null where stored current is empty/null, overwrite LORIOT source (name, model, lat, etc). For locationSource = MANUAL or VERIFIED, skip LORIOT lat/lng/address.
  - **Fail-safe sync failure (FR-S7)**: If sync throws, GatewaySyncRun is persisted as FAILED; no gateway status changes are applied. Gateway rows stay as last known values.
- **Coverage**: FR-S1..S8, FR-S5, C-2 duration config, AC-2, AC-10.
- **Task-local Test Requirements (TR)**:
  - TR-4.1 (rule, maps AC-2): Simulate adapter throw → GatewaySyncRun rows exist with status FAILED; JPA query `SELECT count(g) FROM Gateway g WHERE g.effectiveStatus='OFFLINE'` unchanged before vs after failed sync.
  - TR-4.2 (rule, maps FR-S4): Seed DB with row having normalizedEui="aa…"; incoming payload with loriotGatewayId="NEW-ID" same normalizedEui → row count 1 (upsert not insert).
  - TR-4.3 (rule, maps FR-S6): Set manual address="My Custom Road" via PUT update; run next sync where LORIOT payload has address = null/blank; persisted address remains "My Custom Road".

---

## Task 5: Gateway Status Engine + alerting grace-period + status history deduplication
- **Status**: pending
- **Priority**: high
- **Owner**: implementer
- **Depends on**: Task 2 entities + Task 4 sync writes LORIOT-reported status fields
- **Scope**: `GatewayStatusService`. Methods:
  - `updateFromLoriotApi(Gateway g, LoriotGateway dto)` → priority-1
  - `updateFromNotification(Gateway g, event)` → priority-2
  - `registerUplinkTraffic(Gateway g, Instant ts)` → priority-3, updates `lastTrafficSeenAt`
  - `computeEffectiveStatusNow(Gateway g)` → uses priority engine FR-ST2
  - Grace period: If new computedStatus OFFLINE && lastStatusChangedAt within offline grace → effectiveStatus DEGRADED or grace-held previous; only after grace → OFFLINE. If comes back → transition ONLINE, resolve auto-alert.
  - De-dupe writes: if prev == new computed skip history row.
- **Coverage**: FR-ST1..FR-ST5, AC-3, AC-11.
- **Task-local Test Requirements (TR)**:
  - TR-5.1 (rule, maps AC-3 priority): LORIOT API says ONLINE last 2 mins ago; uplink metadata absent for > 2h. effectiveStatus == ONLINE. Evidence: entity field value + REST `/summary` count.
  - TR-5.2 (rule, maps FR-ST2 UNKNOWN rule): LORIOT status null, no notifications, no uplinks for 4h, never manually set → effectiveStatus = UNKNOWN. Not OFFLINE.
  - TR-5.3 (rule, maps ST4 grace): Compute OFFLINE transition when grace period still active → effectiveStatus = DEGRADED or previous held (not OFFLINE), alert not yet raised; after grace expires → OFFLINE transition recorded once.

---

## Task 6: Extract gateway metadata from existing LORIOT Application WebSocket uplink path
- **Status**: pending
- **Priority**: medium
- **Owner**: implementer
- **Depends on**: Task 5 (needs `registerUplinkTraffic` call site)
- **Scope**: Edit [LoriotWebSocketIngestor.java](file:///c:/Users/Edwin%20Magodi/Desktop/Projects/smart-monitoring/backend/transformer-service/src/main/java/com/safalifter/transformerservice/ingest/LoriotWebSocketIngestor.java) inner Listener `onText`. After current extractString/extractInt parsing code, add a new pass that checks for `gws`, `gw`, `rxq`, `gweui`, `gwEui`, `rssi`, `snr`, `latitude`, `longitude` etc and, when any gateway identifier exists:
  - calls `GatewayStatusService.registerUplinkTraffic(normalizedEui, Instant.now())` for each `gws[i].gweui` / root-level `gweui`
  - Does NOT break the existing decode logic; runs in a try/catch inside async queue so any errors do not drop the uplink.
- **Coverage**: FR-A1 (two paths) and C-4 doc; strengthens priority-3 fallback signal for status engine.
- **Task-local Test Requirements (TR)**:
  - TR-6.1 (rule, maps C-4): Manually feed a payload with `gws[0].gweui="AA:BB:CC"` → after onText, row lastTrafficSeenAt > prior stored value.
  - TR-6.2 (rule, maps NFR-5): Old decoder still produces expected controller readings for motion/door etc after the change; call path for ControllerReading.save is unchanged (compile passes + integration point inspection shows no code removal).

---

## Task 7: Gateway notification webhook endpoint
- **Status**: pending
- **Priority**: medium
- **Owner**: implementer
- **Depends on**: Task 3 properties + Task 5 status service
- **Scope**: New `LoriotWebhookController` in integration package:
  - `POST /internal/integrations/loriot/gateway-events`
  - Header validation: `Authorization: Bearer <secret>` matches `loriot.notification-secret`
  - If body parseable: call status service updateFromNotification; persist GatewayStatusHistory if transition
  - Respond 202 (async), 401 invalid/missing auth, 400 parse error
  - Log only event type + gateway identifiers (no full body, no secrets in logs)
- **Coverage**: FR-A4, FR-ST2 priority-2, C-2 LORIOT_NOTIFICATION_SECRET.
- **Task-local Test Requirements (TR)**:
  - TR-7.1 (rule, maps 401): Call endpoint with missing/bad Authorization → 401 HTTP status; status service NOT invoked.
  - TR-7.2 (rule, maps 202): Call endpoint with valid Authorization + valid event JSON → 202, status service updateFromNotification called once.

---

## Task 8: Gateway REST controllers (summary, list, detail, sync, status-history, map, manual edit, delete/decommission)
- **Status**: pending
- **Priority**: high
- **Owner**: implementer
- **Depends on**: Task 2 repositories + Task 4 sync service + Task 5 status engine
- **Scope**: New package `com.safalifter.transformerservice.controller.gateway` with 2 new controller classes + DTOs:
  - `GatewayController` implements FR-REST1: all endpoints listed, `@PreAuthorize` per AC-17 (permission string + legacy privilege + ADMINISTRATOR role list now includes ADMINISTRATOR name so ROLE_ADMINISTRATOR works).
  - Spring DTOs (request, response, patch): record classes with Jakarta validation.
  - Pagination: Spring Data Pageable passed to repository (`Page<Gateway> findBy…(…, Pageable)`).
  - Server-side filtering where feasible (derived queries) with fall-back in-memory filter only when query too complex.
  - Map endpoint `gateways/map`: returns simplified record with id, name, lat, lng, effectiveStatus, maskedMsisdn, lastSeenAt, depotId. No secrets. Strip all admin-only identifiers.
  - Manual gateway creation allowed via POST, but `loriotGatewayId` unique constraint will not allow duplicates.
  - Decommission endpoint (POST /{id}/decommission with reason): sets decommissioned flag, effectiveStatus = NEVER_SEEN/UNKNOWN depending on rule, writes status history.
  - **Scope guard: Suppliers must be blocked in service layer, not only frontend.** Use AccessScopeService/Principal supplier check on edit/create/sync endpoints; throw AccessDenied for supplier-scoped callers.
- **Coverage**: FR-REST1, FR-G1, FR-ST5, AC-1, AC-12, AC-17, AC-4.
- **Task-local Test Requirements (TR)**:
  - TR-8.1 (rule, maps AC-4 supplier block): Mock securityContext with supplier + call gateways endpoints via MockMvc if tests exist, OR service method via AccessScopeService.isSupplier() → method throws or returns 403.
  - TR-8.2 (rule, maps AC-12 secrets): Response from GET gateways/map does not contain pin/puk or token fields.
  - TR-8.3 (rule, maps NFR-2): GET /api/v1/gateways/summary runs 1 aggregated JPQL with grouping; no N+1 queries.

---

## Task 9: SIM Card + Assignment controllers (encrypted reveal, assign transaction)
- **Status**: pending
- **Priority**: high
- **Owner**: implementer
- **Depends on**: Task 2 SimCard + GatewaySimAssignment repos
- **Scope**: `SimCardController` + `GatewaySimAssignmentController`
  - Encrypt pin/puk on write; AES-GCM with config `sim.encryption.key` (fallback to insecure warning in logs if not set + disallow save for safety).
  - Default response DTOs mask ICCID last-4 only (standardized: `************1234`), pin/puk always `****`.
  - `POST /sim-cards/{id}/reveal-sensitive` returns decrypted pin+puk once in single response; writes audit log row with actor email, sim id, timestamp, reason param; never logs pin/puk in the same log line.
  - Assign endpoint `POST /gateways/{gid}/sim-assignments` with `{simId, slotNumber, reason}` → transaction. If assignment for existing active sim exists: set active=false + unassignedAt; save new active=true row with assignedAt.
  - Unassign endpoint sets active=false + unassignedAt, writes reason.
- **Coverage**: FR-SIM1..SIM5, FR-REST2, AC-5, AC-13, AC-6, FR-P4 audit.
- **Task-local Test Requirements (TR)**:
  - TR-9.1 (rule, maps AC-5): GET sim-cards list → DTO.pin/puk literally equals `"****"`. `reveal-sensitive` endpoint returns non-masked only if permission present in caller; 403 if not.
  - TR-9.2 (rule, maps AC-13 transactional assign): 2 concurrent replace-sim requests for same gateway, one must succeed and previous active closed. Second either rejected or serialised to close new stale sim appropriately. No 2 active=true for same sim in final DB.

---

## Task 10: Frontend routes + sidebar (Gateways & SIM pages under Assets)
- **Status**: pending
- **Priority**: high
- **Owner**: implementer
- **Depends on**: Backend Task 8 + 9 (or can be parallel since contracts are defined here).
- **Scope**: Two-file edit.
  - [AppSidebar.tsx](file:///c:/Users/Edwin%20Magodi/Desktop/Projects/smart-monitoring/frontend/src/layout/AppSidebar.tsx): Add NavItems `Gateways` (Router icon, `/gateways`, permission `gateways.view`, hideForSupplier) and `SIM Cards` (SimCard icon, `/sims`, permission `sims.view`, hideForSupplier) immediately after `Sensors` item.
  - [App.tsx](file:///c:/Users/Edwin%20Magodi/Desktop/Projects/smart-monitoring/frontend/src/App.tsx): Add two new routes with `<ProtectedRoute permission="gateways.view" disallowSupplier>...</ProtectedRoute>` for `/gateways` → `<GatewaysIndex />` and `/sims` → `<SimsIndex />`.
  - No Material UI, reuse existing enterprise components only.
- **Coverage**: FE-1, FE-2, NFR-5 style consistency.
- **Task-local Test Requirements (TR)**:
  - TR-10.1 (rule, maps FE-1, AC-4): As admin user: sidebar items present; click navigates to /gateways page renders; as supplier: sidebar not shown, direct /gateways URL redirects to /dashboard.
  - TR-10.2 (rule, maps NFR-7 style): Cards, search, pills, buttons all use classes enterprise-card, powertel-blue-button, enterprise-chip etc per existing pages.

---

## Task 11: Frontend GatewaysIndex page (KPI cards, compact table, filters, map panel, detail modal)
- **Status**: pending
- **Priority**: high
- **Owner**: implementer
- **Depends on**: Task 10 routes
- **Scope**: New folder and file `frontend/src/pages/Gateways/index.tsx`, ~1500 lines max. Reuse Alerts/OculusControl page patterns.
  - 9 StatCards summary (Total, Online, Offline, Degraded, Never Seen, Unknown, Missing Location, Missing SIM, Last Sync Status)
  - Filter row: status pill buttons + search text + selectors region/depot/network/model/operator + "hasLocation" / "hasSim" boolean toggles + date range (last-seen-from/to)
  - Compact enterprise table, 11px action pills: Details, Edit, Sync Now (if sync permission). Full-width table layout per user's preference (no side-by-side lists). Columns match FE-4 spec.
  - Right-hand map panel (inside same page, below filters/cards as a section) using `GoogleAssetMap.tsx`. Color mapping: ONLINE=#22c55e, OFFLINE=#ef4444, DEGRADED=#f59e0b, NEVER_SEEN=#94a3b8, UNKNOWN=#64748b.
  - Detail modal: tabs as per FE-6.
- **Coverage**: FE-3, FE-4, FE-5, FE-6, FE-7, FE-8, NFR-7.
- **Task-local Test Requirements (TR)**:
  - TR-11.1 (rule, maps FE-7 marker colors): Point with effectiveStatus = ONLINE → getMarkerColors returns fillColor="#22c55e"; ONLINE → not "#ef4444" etc.
  - TR-11.2 (rule, maps FE-4 full-width): Table uses `w-full col-span-full` grid and not 50-50 layout; action buttons class names have `11px` or `text-[11px]` or same pill styling as Alerts page.
  - TR-11.3 (rule, maps FE-9 dashboard link): Filter link `pre set via ?status=OFFLINE` query param in URL on nav click from requiring attention list.

---

## Task 12: Frontend SimsIndex page (summary cards, masked table, assign/unassign flows, reveal-sensitive action)
- **Status**: pending
- **Priority**: medium
- **Owner**: implementer
- **Depends on**: Task 10 routes
- **Scope**: New folder/file `frontend/src/pages/Sims/index.tsx` (reuse same layout). Masked values, reveal action only rendered if user has `sims.view_sensitive`. Assign/unassign modals link to gateway picker. Empty + loading states.
- **Coverage**: SIM-S1..S3, AC-5 frontend portion.
- **Task-local Test Requirements (TR)**:
  - TR-12.1 (rule, maps SIM-S2 masked): Table cells show ICCID as `************<last4>`, pin/puk always `****` unless user triggered reveal modal.
  - TR-12.2 (rule, maps SIM-S3 assign): Assign modal opens gateway search list; submit triggers the assign endpoint.

---

## Task 13: Dashboard Gateway KPI tiles + requiring attention list
- **Status**: pending
- **Priority**: low
- **Owner**: implementer
- **Depends on**: Task 8 gateway API + Task 11 GatewaysIndex query params patterns
- **Scope**: Small edit inside [DashboardHome.tsx](file:///c:/Users/Edwin%20Magodi/Desktop/Projects/smart-monitoring/frontend/src/pages/Dashboard/DashboardHome.tsx) detail section (the lazy-loadable matrix block user sees AFTER clicking "Load estate & supplier details"):
  - Mini 3-pill summary (Online, Offline, Degraded) using `/api/v1/gateways/summary`.
  - Small "Requiring attention" list (Offline + Degraded + Missing SIM) 3 rows max with clickable links that navigate to `/gateways?status=OFFLINE` etc.
- **Coverage**: FE-9, Dashboard integration.
- **Task-local Test Requirements (TR)**:
  - TR-13.1 (rule, maps FE-9 lazy): Without clicking "Load supplier details" these mini cards do not render (zero network calls to summary endpoint made until user clicks CTA).

---

## Task 14: Build + local Docker rebuild verification
- **Status**: pending
- **Priority**: medium
- **Owner**: implementer
- **Depends on**: Tasks 1-13 all completed
- **Scope**: Run locally:
  1. `mvn -DskipTests compile` for auth-service + transformer-service (Windows: `& "C:\Program Files\apache-maven-3.9.12\bin\mvn.cmd"`)
  2. `cd frontend; npm run build`
  3. `docker compose up -d --build --remove-orphans`
  4. After containers up, confirm auth-service, transformer-service, transformer-frontend are `Up` > 30s, not crash-looping; inspect 120 tail logs for no startup errors.
  5. Secrets leak test: Search logs, compiled JAR strings for user-supplied key last4 `sKgc`.
- **Coverage**: AC-7, AC-8, AC-6, C-1, C-2.
- **Task-local Test Requirements (TR)**:
  - TR-14.1 (rule, maps AC-7): Maven compile + npm build exit codes 0.
  - TR-14.2 (rule, maps AC-8): `docker compose ps` shows all three services `State = Up`. Container inspect StartedAt timestamp older than 30s, no recent restart counts.
  - TR-14.3 (rule, maps AC-6/C-1): `docker compose logs auth-service transformer-service --tail 500 | Select-String "sKgc"` → no matches (case-insensitive).

---

## Review checkpoint checklist (used in Review Phase by independent reviewer)

| # | Checkpoint (from AC) | Status |
|---|---|---|
| R-1 | AC-1: Admin can see gateways table + map + summary cards | pending |
| R-2 | AC-2: Sync button works; failed sync does NOT delete/mark-all-OFFLINE | pending |
| R-3 | AC-3: Priority-based status engine correct | pending |
| R-4 | AC-4: Supplier users cannot see/call gateway/sim resources | pending |
| R-5 | AC-5: SIM PIN/PUK masked by default, reveal endpoint is permissioned + audited | pending |
| R-6 | AC-6: No secrets leaks in code/build/logs | pending |
| R-7 | AC-7 & 8: Build passes + local docker containers up | pending |
| R-8 | AC-9/10: Duplicate EUI rule (normalize unique working) + manual fields not overwritten on sync | pending |
| R-9 | AC-11/13: Status history + SIM assignment transaction dedupe | pending |
| R-10 | AC-12: map endpoint strips secrets | pending |
| R-11 | AC-14: Package separation clean, LORIOT code in its own package | pending |
| R-12 | AC-15 (rubric): Design adaptability meets threshold ≥ 3 | pending |
| R-13 | AC-16 (rubric): Performance predictability ≥ 3 | pending |
| R-14 | AC-17/18: Permissions in @PreAuthorize AND DataLoader correctly assigned | pending |

---

Cancelled items must have explicit user approval recorded here.
