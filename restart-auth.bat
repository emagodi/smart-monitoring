@echo off
echo Restarting auth-service...
docker-compose stop auth-service
docker-compose rm -f auth-service
echo.
echo Rebuilding auth-service...
docker-compose up -d --build auth-service
echo.
echo Waiting for logs...
timeout /t 5
docker-compose logs -f auth-service
pause
