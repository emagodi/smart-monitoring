# Live Server Deployment

This deployment uses:

- Docker for all application services
- external MySQL on the LAN, not inside Docker

Current live database settings:

- MySQL host: `192.168.15.228`
- MySQL port: `3306`
- MySQL username: `root`
- MySQL password: `Power@Dev25`

## Files Added for Live Deployment

- [`.env.live`](file:///c:/Users/Edwin%20Magodi/Desktop/Projects/smart-monitoring/.env.live)
- [`docker-compose.live.yml`](file:///c:/Users/Edwin%20Magodi/Desktop/Projects/smart-monitoring/docker-compose.live.yml)

## Before You Start

Make sure the live MySQL server:

1. is running and reachable on `192.168.15.228:3306`
2. has these databases created:
   - `auth`
   - `tms`
   - `notifications`
3. allows connections from the Docker host
4. has the `root` user allowed to connect from your application host

If the databases do not exist yet, create them:

```sql
CREATE DATABASE IF NOT EXISTS auth;
CREATE DATABASE IF NOT EXISTS tms;
CREATE DATABASE IF NOT EXISTS notifications;
```

## Folder to Use on the Server

Put the project in a normal working folder, for example:

```powershell
C:\apps\smart-monitoring
```

That folder should contain:

- `.env.live`
- `docker-compose.live.yml`
- `backend\`
- `frontend\`

## Step-by-Step Commands

Open PowerShell on the server and run:

```powershell
mkdir C:\apps -ErrorAction SilentlyContinue
git clone <YOUR_REPO_URL> "C:\apps\smart-monitoring"
cd "C:\apps\smart-monitoring"
```

If the repo is already there:

```powershell
cd "C:\apps\smart-monitoring"
git pull
```

## Review the Live Environment File

Open:

```powershell
notepad ".env.live"
```

Confirm these values are correct:

- `MYSQL_HOST=192.168.15.228`
- `MYSQL_PORT=3306`
- `MYSQL_USERNAME=root`
- `MYSQL_PASSWORD=Power@Dev25`

Also confirm WhatsApp and Loriot values before first launch.

## Build and Start the Stack

Run:

```powershell
docker compose --env-file ".env.live" -f "docker-compose.live.yml" up -d --build
```

## Check Running Containers

```powershell
docker compose --env-file ".env.live" -f "docker-compose.live.yml" ps
```

## Check Logs

Gateway:

```powershell
docker compose --env-file ".env.live" -f "docker-compose.live.yml" logs -f gateway
```

Transformer service:

```powershell
docker compose --env-file ".env.live" -f "docker-compose.live.yml" logs -f transformer-service
```

Notification service:

```powershell
docker compose --env-file ".env.live" -f "docker-compose.live.yml" logs -f notification-service
```

Auth service:

```powershell
docker compose --env-file ".env.live" -f "docker-compose.live.yml" logs -f auth-service
```

## Expected Live Ports

- frontend: `3000`
- gateway: `8087`
- auth-service: `8082`
- transformer-service: `8083`
- notification-service: `8085`
- config-server: `8888`
- eureka-server: `8761`

## Smoke Checks

From the server:

```powershell
Invoke-WebRequest "http://localhost:8087/api/v1/transformers" -UseBasicParsing
```

Frontend:

```text
http://<server-ip>:3000
```

Gateway:

```text
http://<server-ip>:8087
```

## Stop the Stack

```powershell
docker compose --env-file ".env.live" -f "docker-compose.live.yml" down
```

## Rebuild After Updates

```powershell
git pull
docker compose --env-file ".env.live" -f "docker-compose.live.yml" up -d --build
```

## Important Notes

- This live compose file does not start MySQL in Docker.
- All application services use the external MySQL server through environment variables.
- The frontend Nginx container proxies API calls internally to `api-gateway`, so the browser only needs the frontend URL.
- If Windows Firewall is enabled, allow inbound access to at least:
  - `3000`
  - `8087`
  - `8082`
  - `8083`
  - `8085`
