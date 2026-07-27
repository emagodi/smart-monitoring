# Debug Session: oculus-duplicate-readings
- **Status**: [OPEN]
- **Issue**: Oculus/Loriot ingestion saves two readings per uplink (`cmd=gw` with gateway details and `cmd=rx` without), causing duplicate controller presence during assignment.
- **Debug Server**: http://127.0.0.1:<port>/event
- **Log File**: .dbg/trae-debug-log-oculus-duplicate-readings.ndjson

## Reproduction Steps
1. Ensure Loriot webhook (or simulated payload) delivers both `cmd=gw` and `cmd=rx` messages for same `seqno`/`EUI`.
2. Observe two inserts into controller_readings (and/or duplicate controller-side state) for one uplink.
3. In UI/assignment, controller appears duplicated.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | Ingestion handler persists every message regardless of `cmd`, so both `gw` and `rx` create rows | High | Low | Confirmed |
| B | Deduplication key is missing/incorrect (e.g., not using `seqno+EUI+ts`), so duplicates are not detected | High | Med | Not needed (A explains behavior) |
| C | Ingestion path creates controller entities from readings and treats `gw` and `rx` differently, producing duplicate controller rows | Med | Med | Rejected (same controllerId used) |
| D | Two different webhook sources/paths are writing into the same table (e.g., rx path and gw path are separate listeners) | Low | Med | Rejected (same handler logs both) |

## Log Evidence
- Pre-fix (both persisted)
  - `cmd=gw` saved: `runId=pre-fix msg="saving controller reading"`
  - `cmd=rx` saved: `runId=pre-fix msg="saving controller reading"`
- Post-fix (only `gw` persisted)
  - `cmd=gw` saved: `runId=post-fix msg="saving controller reading"`
  - `cmd=rx` ignored: `runId=post-fix msg="ignoring rx message (gw will be persisted)"`

## Verification Conclusion
- Root cause: `OculusWebSocketIngestor.processMessage` accepted both `cmd=gw` and `cmd=rx` and persisted both into `controller_readings`.
- Fix: ignore `cmd=rx` and persist only `cmd=gw` (and derive RSSI/SNR from `gws[0]` when present).
