@echo off
echo Stopping and removing containers, networks, and volumes...
docker-compose down -v
echo.
echo Building and starting containers...
docker-compose up -d --build
echo.
echo Done!
pause
