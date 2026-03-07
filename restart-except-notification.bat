@echo off
echo Stopping services (except notification-service)...
docker-compose stop auth-service transformer-service transformer-frontend gateway vision-ai-service camera-ingestion mysql config-server eureka-server mosquitto

echo Removing containers...
docker-compose rm -f auth-service transformer-service transformer-frontend gateway vision-ai-service camera-ingestion mysql config-server eureka-server mosquitto

echo Removing MySQL volume (to clear data)...
docker volume rm smart-monitoring_mysql_data

echo.
echo Rebuilding and starting services...
docker-compose up -d --build

echo.
echo Done! Services restarted (Notification Service was preserved).
pause
