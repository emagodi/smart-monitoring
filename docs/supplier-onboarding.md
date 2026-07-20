# Supplier Onboarding Guide

This project supports supplier-specific ingestion, ownership, and portal visibility.

## Current Model

- `auth-service` stores supplier organisations in `suppliers`.
- Users can belong to a supplier through `user.supplier_id`.
- `transformer-service` reads supplier scope from `auth-service` through `GET /api/v1/auth/access/email/{email}`.
- Domain records such as transformers, controllers, sensors, and alerts carry `supplierCode` and `supplierName`.
- Frontend detects supplier users from the login payload and hides internal ZESA-only pages.

## Backend Steps For A New Supplier

1. Create the supplier seed in `backend/auth-service/src/main/java/com/safalifter/authservice/config/DataLoader.java`.
   - Add `upsertSupplier("supplier-code", "Supplier Name", "Description")`.

2. Create or reuse a supplier-scoped role.
   - Include permissions such as:
   - `dashboard.read`
   - `dashboard.supplier`
   - `transformers.create`, `transformers.read`, `transformers.update`
   - `controllers.create`, `controllers.read`, `controllers.update`
   - `sensors.create`, `sensors.read`, `sensors.update`
   - `alerts.read`

3. Seed or create supplier users in `DataLoader.java`.
   - Set `userType = Supplier`
   - Set `supplier = supplierRepository.findByCode("supplier-code")`
   - Clear internal `region`, `district`, and `depot` fields

4. Create a new ingestor class in `backend/transformer-service/src/main/java/com/safalifter/transformerservice/ingest`.
   - Follow the pattern used by `OculusWebSocketIngestor`.
   - Add `@ConditionalOnProperty(prefix = "supplier.ws", name = "enabled", havingValue = "true")`.
   - Read only that supplier's websocket URL.
   - Tag all auto-created records with:
   - `supplierCode = "supplier-code"`
   - `supplierName = "Supplier Name"`

5. Store flexible decoded data.
   - Use `ControllerReading.decodedPayload` for full decoded JSON.
   - Do not assume every supplier has `di1` and `di2`.
   - Keep fixed columns only for metrics that are truly common or needed for fast alert rules.

6. Add configuration keys in:
   - `backend/transformer-service/src/main/resources/application.properties`
   - `backend/config/transformer-service.properties`
   - Example:
   ```properties
   supplier.ws.enabled=true
   supplier.ws.url=wss://example
   supplier.ws.log=true
   ```

7. Scope new data in service and repository layers.
   - Reuse `AccessScopeService`.
   - Add repository methods like `findAllBySupplierCode(...)` and `findByIdAndSupplierCode(...)`.
   - Apply scope checks in create, read, update, and delete paths.

## Frontend Steps For A New Supplier

1. Ensure login payload includes:
   - `supplier_id`
   - `supplier_code`
   - `supplier_name`

2. Use supplier detection:
   - `Boolean(user?.supplierCode) || (user?.userType || '').toLowerCase() === 'supplier'`

3. Hide internal routes and sidebar items.
   - Regions
   - Districts
   - Depots
   - Sites
   - User administration

4. Show supplier-scoped pages only.
   - Dashboard
   - Transformers
   - Controllers
   - Sensors
   - Alerts

5. When building new screens, read from already scoped backend endpoints.
   - Example:
   - `GET /api/v1/transformers`
   - `GET /api/v1/controllers`
   - `GET /api/v1/sensors`
   - `GET /api/v1/alerts`

6. Keep forms supplier-safe.
   - Supplier users should not enter region, district, or depot unless that supplier workflow genuinely needs those fields.

## Current Active Supplier

- Active ingestor: `OculusWebSocketIngestor`
- Enabled config: `oculus.ws.enabled=true`
- Disabled config: `loriot.ws.enabled=false`

Only Oculus ingestion is currently enabled by configuration.
