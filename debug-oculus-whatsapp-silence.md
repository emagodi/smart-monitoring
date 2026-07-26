# Debug Session: oculus-whatsapp-silence

- Status: OPEN
- Started: 2026-07-26
- Scope:
  - Verify `Arm` / `Disarm` behavior on `/oculus-control`
  - Investigate why WhatsApp notifications to `+263773537476` have stopped after previously working

## Hypotheses

1. The web control action succeeds but the UI does not refresh or reflect the accepted backend state.
2. The WhatsApp contact state for `263773537476` is no longer eligible for free-form delivery and template fallback is not activating correctly.
3. Notification routing or recipient preference resolution is no longer including `+263773537476` for relevant alerts.
4. Notifications are being created, but downstream WhatsApp delivery is failing before reaching the handset.
5. Runtime config drift changed a provider/template value and silently broke WhatsApp sends after earlier success.

## Evidence Log

- `/oculus-control` browser session authenticated successfully with the local seeded admin account.
- The page loaded the Oculus list from `GET /api/v1/oculus-control/transformers` and rendered 3 monitored transformers.
- UI verification:
  - Initial state observed: `Armed 2`, `Disarmed 0`, `Unknown 1`
  - UI-triggered `Disarm` action issued `POST /api/v1/oculus-control/transformers/1/disarm`
  - Follow-up state observed: `Armed 1`, `Disarmed 1`, `Pending confirmation 1`
  - UI-triggered `Arm` action issued `POST /api/v1/oculus-control/transformers/1/arm`
  - Final state observed again: `Armed 2`, `Disarmed 0`, `Pending confirmation 1`
- WhatsApp contact state for `263773537476` shows:
  - conversation window closed
  - template fallback active
  - last outbound mode `TEMPLATE`
  - last template `ransformer_security_alert`
  - last provider status `accepted`
- Recent notifications for `+263773537476` are still being created and marked `ACCEPTED`.
- Controlled test notification `reference_id=manual-debug-oculus-whatsapp-silence` was persisted as:
  - `delivery_status=ACCEPTED`
  - `provider_status=accepted`
  - `template_name=ransformer_security_alert`
- The controlled test saved a real `provider_message_id` (`wamid...`) and remains at:
  - `accepted_timestamp` set
  - `delivered_timestamp` null
  - `read_timestamp` null
  - `failed_timestamp` null
- Historical WhatsApp status pattern for `+263773537476`:
  - only 2 messages ever reached `provider_status=delivered`
  - both delivered rows were older free-form sends with `template_name` null
  - later template-based sends are mostly `accepted` only
- Meta sender metadata for the configured phone number confirms:
  - display number `+263 78 282 9296`
  - verified name `Powertel Communications`
  - `quality_rating=GREEN`
  - `status=CONNECTED`
- Meta WABA template lookup confirms:
  - `ransformer_security_alert` exists
  - language `en`
  - status `APPROVED`

## Actions

- Started debugger session `oculus-whatsapp-silence`.
- Verified live `/oculus-control` behavior through the browser.
- Queried notification DB state and WhatsApp contact eligibility state for `+263773537476`.
- Sent a controlled WhatsApp template notification to `+263773537476`.
- Queried live Meta phone number metadata and WABA template state.

## Findings

- Hypothesis 1: Confirmed. The web control UI reflects accepted commands correctly after the row action completes and the list refreshes.
- Hypothesis 2: Rejected. Template fallback is active for the closed 24-hour window and is not currently blocked in backend state.
- Hypothesis 3: Rejected. Recipient routing is still including `+263773537476`.
- Hypothesis 4: Narrowed. Meta accepts the sends but does not progress them to delivered/read in our observed data for current template-based messages.
- Hypothesis 5: Rejected for current runtime. The approved template mapping is active, approved in Meta, and sends are being accepted right now.
- Working conclusion: the app-side send path is healthy; the remaining issue is post-acceptance template delivery between Meta and the handset, or missing post-acceptance status callbacks from Meta.

## Fixes

- No code change applied in this debugging turn.

## Verification

- Awaiting user confirmation whether the latest controlled WhatsApp test was received on the handset.
