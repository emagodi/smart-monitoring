# Debug Session: live-loriot-offline
- **Status**: [OPEN]
- **Issue**: Production shows all controllers/transformers offline while local Loriot upstream/downstream works.
- **Scope**: transformer-service Loriot WebSocket and Loriot REST/downlink connectivity in live environment
- **Log File**: `.dbg/trae-debug-log-live-loriot-offline.ndjson`

## Reproduction
1. Open production Oculus Control page.
2. Observe all controllers are offline with stale keepalive times.
3. Compare with local environment where upstream/downstream works.

## Hypotheses
- A. Live is not starting with `LORIOT_INSECURE_SSL=true`.
- B. WebSocket TLS handshake fails because the Loriot SSL certificate is expired.
- C. REST/downlink path still uses strict SSL in live.
- D. WebSocket connects but no messages are processed/saved.
- E. Live uses different Loriot URL/token/env values from local.

## Evidence
- Pending instrumentation

## Conclusion
- Pending
