@echo off
cd /d "%~dp0"
docker compose down
echo App parada. Los datos se conservan.
timeout /t 5
