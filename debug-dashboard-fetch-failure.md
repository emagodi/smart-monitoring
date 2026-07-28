# Debug Session: dashboard-fetch-failure
- **Status**: [OPEN]
- **Issue**: Production login succeeds, but the dashboard shows "Failed to load dashboard data."
- **Scope**: Frontend dashboard fetch path through gateway and backend services
- **Log File**: `.dbg/trae-debug-log-dashboard-fetch-failure.ndjson`

## Reproduction
1. Open the production site and log in successfully.
2. Land on the dashboard page.
3. Observe the banner: `Failed to load dashboard data.`

## Hypotheses
- A. Gateway route or downstream service registration issue
- B. Token accepted for login, but dashboard API returns auth failure
- C. Dashboard endpoint returns 5xx and UI maps it to a generic message
- D. Production frontend is calling the wrong `/api` base path
- E. Service startup order or registration race leaves dashboard APIs unavailable

## Evidence
- Pending instrumentation

## Conclusion
- Pending
