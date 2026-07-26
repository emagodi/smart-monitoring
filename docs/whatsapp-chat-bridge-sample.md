# WhatsApp Chat Bridge Sample

This project now exposes a dedicated bot bridge endpoint for Oculus arm/disarm commands:

- Method: `POST`
- URL: `/api/v1/chat-commands/oculus`
- Header: `X-Chat-Bridge-Key: <CHAT_COMMAND_BRIDGE_KEY>`

## Recommended Bot Flow

1. Your existing company bot receives a WhatsApp message on the verified business number.
2. The bot validates intent and extracts:
   - sender WhatsApp number
   - action: `ARM` or `DISARM`
   - target transformer id
3. The bot forwards the command to this system.
4. This system:
   - resolves the sender from auth-service by WhatsApp number or phone
   - checks the temporary access policy
   - enforces supplier scope where applicable
   - calls the existing Oculus control service
   - fans out typed notifications through notification-service

## Request Payload

```json
{
  "sender": "+263771234567",
  "transformerId": 123,
  "action": "ARM",
  "source": "company-bot",
  "commandText": "arm transformer 123"
}
```

## cURL Example

```bash
curl -X POST "http://localhost:8087/api/v1/chat-commands/oculus" \
  -H "Content-Type: application/json" \
  -H "X-Chat-Bridge-Key: change-me" \
  -d '{
    "sender": "+263771234567",
    "transformerId": 123,
    "action": "ARM",
    "source": "company-bot",
    "commandText": "arm transformer 123"
  }'
```

## Success Response

```json
{
  "status": "ACCEPTED",
  "action": "ARM",
  "transformerId": 123,
  "transformerName": "Mabelreign 500kVA",
  "supplierCode": "oculus",
  "operatorName": "John Foreman",
  "providerStatus": "ACCEPTED",
  "message": "Arm command queued successfully"
}
```

## Common Failure Cases

- `403 Invalid chat bridge key`
  - The bot bridge header does not match `CHAT_COMMAND_BRIDGE_KEY`.
- `403 Sender is not allowed to control transformers`
  - The number is mapped to a user outside the temporary access rule.
- `403 Supplier user cannot control another supplier's transformer`
  - Supplier-scoped user attempted to act outside their supplier estate.
- `404 Transformer not found`
  - The extracted transformer id does not exist.
- `400 Unsupported action`
  - Only `ARM` and `DISARM` are currently supported.

## Runtime Variables

Set these in `.env` and restart Docker:

```env
ZESA_MAIL_HOST=
ZESA_MAIL_PORT=587
ZESA_MAIL_USERNAME=
ZESA_MAIL_PASSWORD=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_API_VERSION=v25.0
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_VERIFY_TOKEN=
CHAT_COMMAND_BRIDGE_KEY=
```

Notes:

- `WHATSAPP_VERIFY_TOKEN` is typically used by your existing WhatsApp bot/webhook project during Meta verification. This bridge does not require Meta to call it directly.
- `WHATSAPP_API_URL`, `WHATSAPP_API_TOKEN`, and `WHATSAPP_BUSINESS_NUMBER` are still supported as generic overrides if you ever switch away from Meta Cloud API.

## Bot Adapter Pseudocode

```js
async function forwardCommand(incoming) {
  const sender = incoming.from;
  const parsed = parseIntent(incoming.text);

  if (!parsed || !parsed.transformerId || !parsed.action) {
    return reply(sender, "Use ARM <transformerId> or DISARM <transformerId>.");
  }

  const response = await fetch("http://localhost:8087/api/v1/chat-commands/oculus", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Chat-Bridge-Key": process.env.CHAT_COMMAND_BRIDGE_KEY
    },
    body: JSON.stringify({
      sender,
      transformerId: parsed.transformerId,
      action: parsed.action,
      source: "company-bot",
      commandText: incoming.text
    })
  });

  const data = await response.json();
  return reply(sender, data.message || data.status || "Command processed.");
}
```
