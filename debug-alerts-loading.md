# Debug Session: alerts-loading
- **Status**: [OPEN]
- **Issue**: Alerts page for administrator login stays on loading state indefinitely instead of rendering the alert operations desk.
- **Debug Server**: TBD
- **Log File**: .dbg/trae-debug-log-alerts-loading.ndjson

## Reproduction Steps
1. Login as `emagodi1@powertel.co.zw`.
2. Navigate to `/alerts`.
3. Observe the page remain on `Loading alert operations desk...`.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | `GET /api/v1/alerts` is hanging or very slow for admin scope because admin loads all alerts across the estate | High | Low | Pending |
| B | The alerts list returns, but a follow-up selection/detail call causes the UI to appear stuck due to very slow timeline or notification audit fetch | Medium | Low | Pending |
| C | Gateway routing or auth forwarding for `/api/v1/alerts/**` works inconsistently for browser requests even though auth endpoints succeed | Medium | Low | Pending |
| D | Admin scope is too broad and the page is choking on volume or serialization, while scoped users would load faster | High | Medium | Pending |
| E | Frontend bundle is running the new page, but the initial request never resolves because of a backend-side blocking query in alert case enrichment | High | Medium | Pending |

## Log Evidence
- `GET /api/v1/alerts` for admin returned `HTTP 200` in about `1.72s`.
- Payload size for admin alerts response is about `78,877,864` bytes (~75 MB).
- Sample payload confirms real alert rows are returned with transformer, depot, supplier, and timestamps.
- First alert id extracted successfully as `90650`.

## Verification Conclusion
- Hypothesis A: **Rejected** as a pure request hang; the endpoint responds successfully and relatively quickly.
- Hypothesis D: **Confirmed** that admin scope is extremely broad and returns a very large dataset.
- Hypothesis E: **Likely**; the browser is probably choking on parsing/rendering the massive all-alert response and then running selection/detail logic on top.
- Hypothesis B/C: still pending direct evidence from `/api/v1/alerts/{id}/timeline` and `/v1/notification/reference/{id}`.
