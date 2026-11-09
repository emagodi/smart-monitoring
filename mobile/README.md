# TIAS mobile app

The TIAS app for the reaction team, partners and supervisors. It uses the same accounts, permissions and endpoints as the web portal.

- **Stack:** Expo SDK 58 (React Native 0.88, React 19.3, New Architecture), Expo Router and TypeScript.
- **Package:** `zw.co.powertel.tias` (Android and iOS).

## What it does

| Tab / screen | What people can do |
|---|---|
| **Home** | See their duty status and the alerts waiting for them, plus transformers online, offline and delayed. Gateways online and open faults are shown with their permissions. Average acknowledge / arrive / close times cover the last 30 days. |
| **Respond** | Incidents in three lists: New, In progress and Closed in the last 24 h. The list refreshes every 15 s. |
| **Incident** | Acknowledge, mark "We are on site", or close with an outcome: false alarm, real threat, technical fault, authorised work or other. Also: directions to the site, call the crew lead, arm or disarm the site, the progress steps and the timeline. |
| **Assets** | Transformers: search, status filters, open alerts and faults, and the gateway each one reports through. Gateways: status filters, "Receiving transformers" / "Never received", and how many transformers each gateway relays. |
| **Transformer** | Status, last signal and alarm state. Also shows open fault alarms, recent alerts, gateways with signal strength, devices and directions. Users can raise a fault alarm (with "pause alerts until fixed") and arm or disarm the site. |
| **Gateway** | Status, why it is online or offline, LORIOT and traffic times, EUI and location. Lists the transformers it hears, with signal strength. |
| **Fault alarms** | Open and fixed faults. Pause or resume alerts, and mark a fault fixed with a note. |
| **Installations** | Installed, ready, scheduled, commissioned and failed sites. Partners tap **Ready for commissioning**. |
| **More** | Profile and duty status. Shows whether push alerts are on, with **Test siren** and set-up buttons. Also shows the server address and a sign-out button. |

### The siren

- **App open:** while alerts are waiting to be acknowledged, a red card floats above every screen. The phone plays the siren and vibrates until someone acknowledges the alert (on the phone, the web, WhatsApp or USSD) or the user mutes it for 5 minutes.
- **App closed:** the server sends a push notification with the siren sound on the "Intrusion alerts" channel. That channel uses maximum importance, appears on the lock screen and bypasses Do Not Disturb on Android. Tapping it opens the incident.
- **Who receives alerts:** the people on duty for that depot. If nobody is on duty there, everyone in that depot (or national) who can acknowledge alerts. This is the same rule as the web siren.

## Run it

You need Node 22.13 or newer (22.x LTS or 24.x). Node 23 and 25 are not supported by SDK 58.

```bash
cd mobile
npm install
npx expo start          # press "a" for Android, or scan the QR code
```

Expo Go may not support SDK 58 yet, and push notifications never work in Expo Go. Use a development build or the preview APK (below) on a real phone.

## Build with EAS

Do this once. You need to be signed in to the Expo account that will own the app.

```bash
npx eas-cli@latest login
npx eas-cli@latest init        # writes extra.eas.projectId into app.json (needed for push)
npx eas-cli@latest credentials # Android: let EAS create the keystore; also upload the FCM v1 key (see below)
```

Then build:

```bash
npm run build:apk     # internal test APK (profile "preview"); share the link with the team
npm run build:prod    # Play Store bundle + App Store build (profile "production", version auto-increments)
```

### Push notifications

1. **Android (FCM):** create a Firebase project and add the Android app `zw.co.powertel.tias`. Download `google-services.json` and put it in this folder. Add `"googleServicesFile": "./google-services.json"` under `expo.android` in `app.json`. Upload the FCM V1 service-account key with `eas credentials` (Android > Push Notifications).
2. **iOS (APNs):** `eas credentials` creates the APNs key for you.
3. **Server:** transformer-service sends to `https://exp.host`. The server must be able to reach that address on the internet. If you turn on "Enhanced push security" for the Expo project, also set `EXPO_ACCESS_TOKEN` (property `expo.access-token`). To switch pushes off, set `mobile.push.enabled=false`.

## Server address

The default is `http://154.73.80.22`, set in `app.json` under `expo.extra.apiUrl`. To use a different server on one phone, tap the address under the Powertel logo on the sign-in screen.

Android needs cleartext (http) to be allowed, and `expo-build-properties` turns this on. Once the portal has HTTPS, change `apiUrl` to the https address. Then remove `usesCleartextTraffic` and `NSAllowsArbitraryLoads`.

## Checks

```bash
npm run typecheck     # tsc --noEmit
npx expo-doctor@latest
npx expo install --check
```

## Brand assets

- `assets/images/icon.png` is the TIAS app icon: a shield and power bolt with signal arcs, in Powertel blue and red. Android uses the adaptive and monochrome variants, and `notification-icon.png` is the white status-bar icon.
- `assets/images/powertel.png` is the Powertel logo used on the sign-in screen.
- `assets/sounds/siren.wav` is the alert sound, used both in the app and in push notifications.
