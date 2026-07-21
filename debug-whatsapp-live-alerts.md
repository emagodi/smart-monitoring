# Debug Session: whatsapp-live-alerts
- **Status**: [OPEN]
- **Issue**: Real WhatsApp transformer alerts need to flow for live motion, door-open, and vibration events, with Meta webhook status tracking and no forced manual "Hi" dependency where possible.
- **Debug Server**: Pending
- **Log File**: .dbg/trae-debug-log-whatsapp-live-alerts.ndjson

## Reproduction Steps
1. Trigger or observe a real monitored transformer event such as motion, door open, or vibration.
2. Confirm `transformer-service` emits a notification request to `notification-service`.
3. Confirm `notification-service` resolves recipients and selects text vs template mode.
4. Confirm Meta accepts the message and webhook updates `ACCEPTED`, `DELIVERED`, `READ`, or `FAILED`.
5. Confirm inbound WhatsApp activity updates conversation state so free-form text is used within the 24-hour window.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | The `whatsapp_contact_state` table is missing because schema auto-update is not creating the new entity table in the deployed notification-service runtime. | High | Low | Confirmed: startup DDL failed with `type=MyISAM` under `org.hibernate.dialect.MySQLDialect`; fixed by switching to `org.hibernate.dialect.MySQL8Dialect`, after which `whatsapp_contact_state` was created. |
| B | Real controller-trigger events are reaching `notification-service`, but recipient preference or number resolution is filtering out WhatsApp recipients for live alerts. | High | Medium | Confirmed: live references `92021` and `92022` reached `notification-service` but routed only to email for supplier user `2`; fixed by adding WhatsApp number and WhatsApp-enabled preferences to the supplier-scoped recipient. |
| C | Outside the 24-hour service window, live alerts are falling back to free-form text instead of an approved template, so delivery is blocked or degraded. | Medium | Medium | Partially confirmed: debug logs show `usesTemplate=false`; no approved template names have been discovered yet, so outside-window fallback is still unresolved. |
| D | The current notification-service webhook is only locally reachable, so real Meta status callbacks for delivered/read/failed are not arriving from the public internet. | High | Medium | Partially confirmed: public tunnel is now live at `https://nice-nails-clean.loca.lt/v1/notification/whatsapp/webhook`, but Meta has not yet been subscribed to this callback. |
| E | Inbound WhatsApp messages are not being persisted even after webhook POSTs because the repository/entity mapping or database target differs between local code and the running container. | Medium | Medium | Rejected after fix: inbound webhook POST succeeded and persisted `wa_id=263773537476`, `last_inbound_message_id=wamid.inbound.post.fix`. |

## Log Evidence
- `notification-service` startup before fix: `Error executing DDL ... create table whatsapp_contact_state ... type=MyISAM`
- `notification-service` startup after fix: `Using dialect: org.hibernate.dialect.MySQL8Dialect`
- MySQL after fix: tables include `notifications`, `whatsapp_contact_state`
- Debug log `B`: live `CONTROLLER_TRIGGER` references `92021` and `92022` resolved recipients for supplier `oculus`
- Debug log `B`: before recipient update, dispatch target for live alerts was only `channel=EMAIL`, `userId=2`
- Debug log `B`: after recipient update, supplier-scoped test `live-route-test-001` dispatched to both `EMAIL` and `WHATSAPP`
- Debug log `C`: WhatsApp mode selection showed `hasOpenConversationWindow=true`, `usesTemplate=false` after inbound `Hi` persistence
- Debug logs `E` and `D`: inbound webhook persisted and completed without server error
- Notifications DB after recipient update: `CONTROLLER_TRIGGER / WHATSAPP / +263773537476 / ACCEPTED / live-route-test-001`

## Verification Conclusion
- Pre-fix:
  - Direct WhatsApp send and inbound webhook paths could fail because `hasOpenConversationWindow()` queried a table that Hibernate never created.
  - Real live controller-trigger events were reaching `notification-service`, but only email was eligible for supplier-scoped delivery.
- Post-fix:
  - `whatsapp_contact_state` exists and inbound `Hi` state is persisted.
  - Direct WhatsApp send is accepted again.
  - Supplier-scoped `CONTROLLER_TRIGGER` routing now reaches both email and WhatsApp for the live Oculus supplier path.
  - Public webhook URL is available, but real Meta delivered/read/failed callbacks still require Meta-side subscription.
  - Automatic template fallback is coded but not production-ready until approved template names are known.
