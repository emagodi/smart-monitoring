# Dashboard, map, performance and one look: release notes

## What changed for users
- **Oqulus.** The partner is shown as "Oqulus" on every screen.
  - Partner codes stay `oculus`. The rename is display only.
  - It is applied in one place: an axios response interceptor in `src/lib/brand.ts`.
- **Sidebar matches access.**
  - A link only shows when the user has its permission.
  - Regions, Districts and Depots now honour the tickable permissions (`regions.read`, `depots.read`, …). Before, they also required a legacy role, so a Contact Centre Agent saw the links but got "Failed to fetch".
- **Dashboard.**
  - Small figure tiles at the top: regions, depots, transformers, online, offline, armed, disarmed, open incidents.
  - Below them, a map workspace:
    - Green dots are online, red offline, amber delayed, grey never seen.
    - There is no "your location" pin and no pop-up.
    - Clicking a dot or a list row opens the transformer in the side panel: devices, last signal, arm state, last 3 alerts, and links to full details, alerts or the registry.
    - "Back to map list", Esc or the browser Back button returns to the same map view. The selection is kept in the URL (`?t=id`).
  - Search finds a name or device EUI anywhere in scope and zooms the map to it.
- **Sites.** The same map workspace, full height.
- **Insights.** Partners are a sortable, searchable, paginated table. This works for 20+ partners.
  - Click a partner to expand its detail.
  - Highlights: best device health, most open incidents, fastest arrival.
- **One look.** Every main page uses the page kit in `src/components/ui/page`: hero header with compact figures, then panel tables.
  - Applies to Dashboard, Insights, Regions, Districts, Depots, Sites, Transformers, Sensors, Gateways, SIM cards, New controllers, Oqulus control, Alerts, Response desk, Fleet, Integrations, Users, Roles, Permissions and User types.
  - Regions, Districts and Depots are one component (`src/pages/Geo/GeoAdmin.tsx`): health and incidents rolled up from the overview, click to drill down, create / rename / delete in dialogs.

## Why it is faster
- **Map loads only the visible area.**
  - `GET /api/v1/transformers/map?south&west&north&east&zoom&status&q`
  - If more than 600 transformers are in view, it returns about 8×8 numbered groups instead of dots. Click a group to zoom in.
- **One small dashboard call.** `GET /api/v1/transformers/stats`. It replaced the old dashboard, which downloaded every transformer, sensor and alert.
- **Short server caches per scope** (`util/TtlCache`). They are per partner and per depot, so nobody sees another scope's data.
  - Registry rows: 20 s, shared by the registry, map, stats and insights.
  - Insights overview: 30 s.
  - Alert summary: 15 s, cleared when a case changes.
  - Concurrent identical requests wait for one database query.
- **Browser cache (stale-while-revalidate)** in `src/lib/cache.ts`. A page visited before draws at once from memory and refreshes in the background.
  - The Region → District → Depot hierarchy is fetched once per session (5 min).
- **Lazy loading.** Alert counts load separately from the alert list, so the list never waits for them. Figures show skeletons while loading.
- **Alerts "Last 24 hours"** now counts alerts that fired in the last day, including repeats folded into an older open alert. It was counting only new rows.
- **Database.** Schema upgrader adds `idx_alerts_last_seen_at`.

## Fixed in passing
- Gateways: clicking a SIM cell and unassigning a SIM referenced undefined variables and crashed.
- Response desk: "Real threats · 30d" showed "undefined / NaN" when the summary lacked closure counts.
- Wide tables no longer push the whole page wider than the screen (`min-w-0` on the layout column).

## Deploy
Rebuild and restart **auth-service**, **transformer-service** and the **frontend**. No SQL to run.
