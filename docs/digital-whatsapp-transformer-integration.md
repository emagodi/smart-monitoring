# Digital WhatsApp Transformer Integration

This document defines how the digital services chatbot should integrate with smart-monitoring when both systems share the same WhatsApp business number.

## Recommended Ownership

- `digital services` owns:
  - Meta webhook subscription
  - WhatsApp message sending
  - delivery and read status tracking
  - the conversational bot flow
- `smart-monitoring` owns:
  - transformer search
  - user authorization and supplier scoping
  - arm and disarm execution
  - transformer alert generation and security logic

The digital services backend should call smart-monitoring through internal integration endpoints. Smart-monitoring should not be the direct Meta chatbot owner for the shared number.

## Authentication

All digital integration calls to smart-monitoring must send:

- Header: `X-Smart-Integration-Key: <shared-secret>`

Use the same shared secret configured in smart-monitoring as:

- env: `CHAT_COMMAND_BRIDGE_KEY`

## Smart-Monitoring Endpoints

Base path:

- `/api/v1/integrations/digital`

Recommended base URL options:

- direct internal service: `http://transformer-service:8083`
- via smart-monitoring gateway: `http://api-gateway:8080`

If the digital stack is outside this Docker network, use the reachable host or ingress URL that maps to the same smart-monitoring gateway.

## LAN Deployment Between Two Servers

For the current environment:

- smart-monitoring server IP: `192.168.15.228`
- digital services server IP: `192.168.15.239`

Because the digital server is internet-facing and smart-monitoring is only reachable on the internal LAN, the recommended setup is:

- digital services keeps Meta webhook ownership
- digital services keeps all WhatsApp send and receive logic
- digital services calls smart-monitoring over the LAN using the smart-monitoring server IP

Recommended LAN base URL options for the digital server:

- preferred via gateway: `http://192.168.15.228:8087`
- direct to transformer-service: `http://192.168.15.228:8083`

Use the gateway URL unless there is a specific reason to call the transformer service directly.

### Network Notes

- The smart-monitoring host must allow inbound TCP traffic from `192.168.15.239`
- Open at least one of these ports on the smart-monitoring host:
  - `8087` for the API gateway
  - `8083` for direct transformer-service access
- No public internet exposure is required for smart-monitoring if digital services is the only caller
- Meta webhooks should continue pointing only to the digital services platform

### 1. Resolve Operator

Use this when the chatbot wants to confirm whether the WhatsApp sender is a valid operator before starting a control flow.

- Method: `GET`
- Path: `/api/v1/integrations/digital/operators/resolve?contact=<phone>`

Example:

```http
GET /api/v1/integrations/digital/operators/resolve?contact=263773537476
X-Smart-Integration-Key: whatsapp-bridge-internal-2026
```

Example response:

```json
{
  "userId": 2,
  "operatorName": "Edwin Magodi",
  "email": "magodi@oculus.co.zw",
  "phone": "+263773537476",
  "whatsappNumber": "+263773537476",
  "status": "ACTIVE",
  "userType": "supplier",
  "supplierCode": "oculus",
  "supplierName": "Oculus",
  "roles": ["Supplier Administrator"],
  "allowedToControl": true,
  "message": "Operator is allowed to control supplier-scoped transformers."
}
```

### 2. Search Transformers

Use this after the user says `Arm transformer` or `Disarm transformer` and then provides a transformer name.

- Method: `POST`
- Path: `/api/v1/integrations/digital/oculus-control/search`

Request body:

```json
{
  "sender": "263773537476",
  "action": "ARM",
  "query": "Parliament",
  "source": "WHATSAPP_DIGITAL"
}
```

Response body:

```json
{
  "status": "MATCHES_FOUND",
  "action": "ARM",
  "operatorName": "Edwin Magodi",
  "message": "Select one of the matching transformers to continue.",
  "options": [
    {
      "transformerId": 1,
      "id": 1,
      "transformerName": "New Parliament Building",
      "name": "New Parliament Building",
      "depotId": 1,
      "supplierCode": "oculus",
      "supplierName": "Oculus",
      "controllable": true,
      "controllerName": "Controller A840410F6E5E19E7 TEST",
      "controllerDevEui": "A840410F6E5E19E7"
    }
  ]
}
```

### 3. Execute Arm or Disarm

Use this only after the user has selected a transformer and explicitly confirmed the action.

- Method: `POST`
- Path: `/api/v1/integrations/digital/oculus-control/execute`

Request body:

```json
{
  "sender": "263773537476",
  "transformerId": 1,
  "action": "DISARM",
  "source": "WHATSAPP_DIGITAL",
  "commandText": "DISARM New Parliament Building"
}
```

Response body:

```json
{
  "status": "ACCEPTED",
  "result": "ACCEPTED",
  "action": "DISARM",
  "transformerId": 1,
  "transformerName": "New Parliament Building",
  "supplierCode": "oculus",
  "operatorName": "Edwin Magodi",
  "providerStatus": "SENT",
  "message": "Disarm command sent to Oculus controller",
  "statusMessage": "Disarm command sent to Oculus controller",
  "detail": "Disarm command sent to Oculus controller"
}
```

## Expected Chatbot Flow on Digital Services

### Arm / Disarm Flow

1. User sends quick reply:
   - `Arm transformer`
   - `Disarm transformer`
2. Digital bot stores the action in its own conversation state.
3. Digital bot asks:
   - `Reply with the transformer name.`
4. When the user replies with a search term, digital calls `search`.
5. If smart-monitoring returns `MATCHES_FOUND`, digital shows a numbered list.
6. User replies with the option number.
7. Digital bot asks for explicit confirmation:
   - `Reply CONFIRM ARM`
   - `Reply CONFIRM DISARM`
8. When confirmed, digital calls `execute`.
9. Digital bot sends the success or failure message back to the user based on the response.

### Important Control Rules

- Never allow direct arm or disarm without explicit confirmation.
- Always pass the sender phone number to smart-monitoring exactly as received from WhatsApp.
- Smart-monitoring is the source of truth for:
  - supplier scoping
  - `allowedToControl`
  - transformer ownership and control access

## Expected Error Handling on Digital Services

If smart-monitoring returns:

- `403`:
  - tell the user they are not allowed to control transformers
- `404`:
  - tell the user the transformer was not found
- `400`:
  - tell the user the command or search input was invalid
- `502`:
  - tell the user the control provider is unavailable and ask them to try again later

## Alert Routing Recommendation

Because the digital services system owns the shared WhatsApp number, transformer alerts should ultimately be sent by the digital services backend, not directly by smart-monitoring to Meta.

Recommended next phase:

1. smart-monitoring raises a transformer alert event
2. smart-monitoring sends that event to a digital-services internal webhook
3. digital services chooses the approved WhatsApp template and sends the actual message
4. Meta delivery and read callbacks stay in one place: the digital services platform

Suggested digital-side webhook for alerts:

- `POST /internal/integrations/smart-monitoring/transformer-alerts`

Suggested payload from smart-monitoring to digital:

```json
{
  "eventType": "CONTROLLER_TRIGGER",
  "referenceId": "144402",
  "supplierCode": "oculus",
  "recipientWhatsappNumber": "+263773537476",
  "templateName": "ransformer_security_alert",
  "languageCode": "en",
  "templateParameters": [
    "New Parliament Building",
    "Motion Detected",
    "Westgate Depot",
    "2026-07-26 11:28"
  ],
  "fallbackText": "Security alert for transformer New Parliament Building. Event detected: Motion Detected. Location: Westgate Depot. Time: 2026-07-26 11:28."
}
```

That alert webhook is recommended, but it is not implemented in smart-monitoring yet.

## Ready-to-Paste Instructions for the Digital Services TRAE Thread

Use this exact brief on the other side:

```text
We are integrating the digital-services WhatsApp bot with the smart-monitoring backend for transformer arm/disarm.

Architecture:
- digital-services remains the only Meta WhatsApp webhook owner
- digital-services remains the only WhatsApp sender for the shared number
- smart-monitoring exposes internal control APIs

Please integrate against these smart-monitoring endpoints:

Base URL:
- direct service on shared Docker network: http://transformer-service:8083
- or gateway on shared Docker network: http://api-gateway:8080
- or over LAN from digital server to smart-monitoring host: http://192.168.15.228:8087

1. Resolve operator
GET /api/v1/integrations/digital/operators/resolve?contact=<phone>

2. Search transformer
POST /api/v1/integrations/digital/oculus-control/search
Header: X-Smart-Integration-Key: <shared-secret>
Body:
{
  "sender": "263773537476",
  "action": "ARM",
  "query": "Parliament",
  "source": "WHATSAPP_DIGITAL"
}

3. Execute command
POST /api/v1/integrations/digital/oculus-control/execute
Header: X-Smart-Integration-Key: <shared-secret>
Body:
{
  "sender": "263773537476",
  "transformerId": 1,
  "action": "ARM",
  "source": "WHATSAPP_DIGITAL",
  "commandText": "ARM New Parliament Building"
}

Behavior expected on the digital side:
- own the full WhatsApp conversation
- store action and selected transformer in chatbot state
- ask for transformer name after user chooses arm or disarm
- call smart-monitoring search endpoint
- show numbered search results
- require explicit confirmation before execute
- call smart-monitoring execute endpoint only after confirmation
- send the final success or failure back to the user in WhatsApp

Do not let smart-monitoring own the Meta webhook for this shared phone number.
Do not let both systems independently talk to Meta for the same chatbot flow.
```
